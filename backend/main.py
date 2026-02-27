import re
import os
import json
import uuid
import base64
import asyncio
import logging
import shutil
import socket
import ipaddress
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager
from urllib.parse import urlparse, quote as urlquote

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

import yt_dlp
from mutagen.id3 import (
    ID3, TIT2, TPE1, TALB, TPE2, TDRC, TRCK, TCON, APIC, ID3NoHeaderError
)
from PIL import Image
import io

# Limit PIL decompression-bomb risk (~50 megapixels)
Image.MAX_IMAGE_PIXELS = 50_000_000

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TEMP_DIR = Path(__file__).parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

# --- Constants -----------------------------------------------------------
VALID_BITRATES = {96, 128, 256, 320}
MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024          # 500 MB per video
MAX_THUMB_BYTES = 2 * 1024 * 1024               # 2 MB thumbnail
MAX_ALBUM_ART_B64_BYTES = 7 * 1024 * 1024       # ~5 MB decoded (base64 overhead ~1.37×)
ALBUM_ART_MAX_DIM = 1000                         # Max px per side when embedding album art
MIN_FREE_DISK_BYTES = 1 * 1024 * 1024 * 1024    # Refuse downloads if <1 GB free
MAX_CONCURRENT_DOWNLOADS = 5                     # Semaphore cap on parallel yt-dlp jobs
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
MAX_FETCH_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

ALLOWED_YT_HOSTNAMES = {
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}

# Trusted CDN hostnames that YouTube thumbnails are served from
ALLOWED_THUMB_HOSTNAMES = {
    "i.ytimg.com",
    "i1.ytimg.com",
    "i2.ytimg.com",
    "i3.ytimg.com",
    "i4.ytimg.com",
    "img.youtube.com",
    "yt3.ggpht.com",
    "yt3.googleusercontent.com",
    "lh3.googleusercontent.com",
}

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-2.5-pro:generateContent"
)

# -------------------------------------------------------------------------

# Semaphore that caps parallel yt-dlp/ffmpeg jobs
_DOWNLOAD_SEM: asyncio.Semaphore  # initialised in lifespan


def cleanup_old_files():
    import time
    now = time.time()
    for f in TEMP_DIR.iterdir():
        if f.is_file() and (now - f.stat().st_mtime) > 3600:
            f.unlink(missing_ok=True)


async def _periodic_cleanup():
    """Run cleanup every 30 minutes so stale files don't accumulate between restarts."""
    while True:
        await asyncio.sleep(1800)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, cleanup_old_files)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _DOWNLOAD_SEM
    _DOWNLOAD_SEM = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
    cleanup_old_files()
    task = asyncio.create_task(_periodic_cleanup())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def _get_client_ip(request: Request) -> str:
    """Return the real client IP.

    Fly-Client-IP is set by Fly.io's edge and cannot be spoofed by clients,
    so it is safe to trust unlike X-Forwarded-For.  Fall back to the direct
    TCP connection IP in all other environments.
    """
    fly_ip = request.headers.get("Fly-Client-IP", "").strip()
    if fly_ip:
        return fly_ip
    if request.client:
        return request.client.host
    return "unknown"


limiter = Limiter(key_func=_get_client_ip)

app = FastAPI(title="YT to Music API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        # Disable legacy browser XSS filter (causes more harm than good in modern browsers)
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' https://fonts.googleapis.com; "
            "font-src https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


_cors_env = os.getenv("CORS_ORIGINS", "").strip()
CORS_ORIGINS: list[str] = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env
    else ["http://localhost:5173", "http://127.0.0.1:5173"]
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# --- Request models -------------------------------------------------------

class DownloadRequest(BaseModel):
    url: str = Field(max_length=2048)
    bitrate: int = 256


class ID3Tags(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    artist: Optional[str] = Field(None, max_length=500)
    album: Optional[str] = Field(None, max_length=500)
    album_artist: Optional[str] = Field(None, max_length=500)
    year: Optional[str] = Field(None, pattern=r"^\d{4}$")
    track_number: Optional[str] = Field(None, max_length=20)
    genre: Optional[str] = Field(None, max_length=100)
    album_art_base64: Optional[str] = None  # Size validated separately


class SaveRequest(BaseModel):
    file_id: str = Field(max_length=36)
    tags: ID3Tags
    filename: str = Field(default="download", max_length=255)


class FetchImageRequest(BaseModel):
    url: str = Field(max_length=2048)


class AiAutofillRequest(BaseModel):
    title: str = Field(default="", max_length=500)
    artist: str = Field(default="", max_length=500)
    album: str = Field(default="", max_length=500)
    album_artist: str = Field(default="", max_length=500)
    year: str = Field(default="", max_length=4)
    track_number: str = Field(default="", max_length=20)
    genre: str = Field(default="", max_length=100)
    youtube_title: str = Field(default="", max_length=500)


# --- Helpers --------------------------------------------------------------

def _validate_youtube_url(url: str) -> bool:
    """Return True only for http(s) YouTube URLs."""
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https") and parsed.hostname in ALLOWED_YT_HOSTNAMES
    except Exception:
        return False


def _validate_file_id(file_id: str) -> bool:
    """Return True only for well-formed v4 UUIDs."""
    return bool(UUID_RE.match(file_id))


def _safe_filename(name: str) -> str:
    keep = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.()")
    sanitized = "".join(c if c in keep else "_" for c in name).strip()
    return sanitized[:100] or "download"


def _safe_log_url(url: str) -> str:
    """Strip control characters and truncate for safe log output."""
    return url.replace("\n", " ").replace("\r", " ").replace("\t", " ")[:200]


def _fetch_thumbnail(url: str) -> bytes:
    """Fetch thumbnail only from trusted CDN hostnames, without following redirects."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Invalid thumbnail URL")

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Thumbnail URL must use http or https")

    if parsed.hostname not in ALLOWED_THUMB_HOSTNAMES:
        raise ValueError(f"Thumbnail host not in allowlist: {parsed.hostname}")

    with httpx.Client(follow_redirects=False, timeout=5.0) as client:
        resp = client.get(url)

    if resp.status_code != 200:
        raise ValueError(f"Thumbnail fetch returned status {resp.status_code}")

    data = resp.content
    if len(data) > MAX_THUMB_BYTES:
        raise ValueError("Thumbnail response exceeded size limit")
    return data


def _check_disk_space():
    """Raise 503 if free disk space in TEMP_DIR falls below the minimum threshold."""
    free = shutil.disk_usage(TEMP_DIR).free
    if free < MIN_FREE_DISK_BYTES:
        raise HTTPException(
            status_code=503,
            detail="Server storage is temporarily full. Please try again later.",
        )


def _download(url: str, opts: dict) -> dict:
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return info or {}


def _cleanup_files(file_id: str):
    for ext in [".mp3", ".webm", ".m4a", ".opus"]:
        (TEMP_DIR / f"{file_id}{ext}").unlink(missing_ok=True)


# --- Endpoints ------------------------------------------------------------

@app.post("/api/download")
@limiter.limit("5/minute")
async def download_video(request: Request, req: DownloadRequest):
    if not _validate_youtube_url(req.url):
        raise HTTPException(status_code=400, detail="URL must be a valid YouTube URL")

    if req.bitrate not in VALID_BITRATES:
        raise HTTPException(
            status_code=400,
            detail=f"Bitrate must be one of {sorted(VALID_BITRATES)}",
        )

    _check_disk_space()

    file_id = str(uuid.uuid4())
    output_path = TEMP_DIR / f"{file_id}.mp3"

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(TEMP_DIR / f"{file_id}.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": str(req.bitrate),
            }
        ],
        "max_filesize": MAX_DOWNLOAD_BYTES,
        "socket_timeout": 30,
        "quiet": True,
        "no_warnings": True,
    }

    try:
        loop = asyncio.get_running_loop()
        async with _DOWNLOAD_SEM:
            info = await loop.run_in_executor(None, lambda: _download(req.url, ydl_opts))
    except yt_dlp.utils.DownloadError as e:
        logger.error("yt-dlp download error for %s: %s", _safe_log_url(req.url), e)
        raise HTTPException(
            status_code=400,
            detail="Download failed. Please check the URL and try again.",
        )
    except Exception:
        logger.exception("Unexpected error during download for %s", _safe_log_url(req.url))
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

    if not output_path.exists():
        raise HTTPException(status_code=500, detail="MP3 file was not created")

    thumbnail_b64 = None
    if info.get("thumbnail"):
        try:
            loop = asyncio.get_running_loop()
            thumb_data = await loop.run_in_executor(
                None, lambda: _fetch_thumbnail(info["thumbnail"])
            )
            img = Image.open(io.BytesIO(thumb_data))
            if img.format not in ALLOWED_IMAGE_FORMATS:
                raise ValueError(f"Thumbnail format not allowed: {img.format}")
            img.thumbnail((500, 500))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            thumbnail_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception:
            thumbnail_b64 = None

    metadata = {
        "file_id": file_id,
        "title": info.get("title", ""),
        "artist": info.get("artist") or info.get("uploader", ""),
        "album": info.get("album", ""),
        "album_artist": info.get("album_artist") or info.get("uploader", ""),
        "year": str(info.get("release_year") or info.get("upload_date", "")[:4] or ""),
        "track_number": "",
        "genre": info.get("genre", ""),
        "thumbnail_b64": thumbnail_b64,
        "duration": info.get("duration"),
        "webpage_url": info.get("webpage_url", req.url),
    }

    return metadata


@app.post("/api/save")
@limiter.limit("10/minute")
async def save_with_tags(request: Request, req: SaveRequest):
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")

    mp3_path = TEMP_DIR / f"{req.file_id}.mp3"

    if not mp3_path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")

    try:
        try:
            tags = ID3(str(mp3_path))
        except ID3NoHeaderError:
            tags = ID3()

        for frame in ("TIT2", "TPE1", "TALB", "TPE2", "TDRC", "TRCK", "TCON", "APIC"):
            tags.delall(frame)

        t = req.tags
        if t.title:
            tags.add(TIT2(encoding=3, text=t.title))
        if t.artist:
            tags.add(TPE1(encoding=3, text=t.artist))
        if t.album:
            tags.add(TALB(encoding=3, text=t.album))
        if t.album_artist:
            tags.add(TPE2(encoding=3, text=t.album_artist))
        if t.year:
            tags.add(TDRC(encoding=3, text=t.year))
        if t.track_number:
            tags.add(TRCK(encoding=3, text=t.track_number))
        if t.genre:
            tags.add(TCON(encoding=3, text=t.genre))
        if t.album_art_base64:
            if len(t.album_art_base64) > MAX_ALBUM_ART_B64_BYTES:
                raise HTTPException(status_code=400, detail="Album art too large (max ~5 MB)")
            try:
                art_data = base64.b64decode(t.album_art_base64, validate=True)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid base64 album art data")
            img = Image.open(io.BytesIO(art_data))
            if img.format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Album art must be one of: {', '.join(sorted(ALLOWED_IMAGE_FORMATS))}",
                )
            img.thumbnail((ALBUM_ART_MAX_DIM, ALBUM_ART_MAX_DIM))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            tags.add(APIC(
                encoding=3,
                mime="image/jpeg",
                type=3,
                desc="Cover",
                data=buf.getvalue(),
            ))

        tags.save(str(mp3_path), v2_version=3)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to write ID3 tags for file_id=%s", req.file_id)
        raise HTTPException(status_code=500, detail="Failed to write tags. Please try again.")

    safe_filename = _safe_filename(req.filename or "download") + ".mp3"
    encoded_filename = urlquote(safe_filename)

    return FileResponse(
        path=str(mp3_path),
        media_type="audio/mpeg",
        filename=safe_filename,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_filename}"; '
                f"filename*=UTF-8''{encoded_filename}"
            )
        },
    )


@app.post("/api/fetch-image")
@limiter.limit("20/minute")
async def fetch_image_url(request: Request, req: FetchImageRequest):
    """Proxy-fetch an image URL on behalf of the client to avoid CORS issues."""
    try:
        parsed = urlparse(req.url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL must use http or https")

    hostname = parsed.hostname or ""
    if not hostname:
        raise HTTPException(status_code=400, detail="URL has no hostname")

    # SSRF protection: resolve hostname off the event loop to avoid blocking it
    try:
        loop = asyncio.get_running_loop()
        resolved_str = await loop.run_in_executor(None, socket.gethostbyname, hostname)
        resolved_ip = ipaddress.ip_address(resolved_str)
    except Exception as e:
        logger.warning("fetch-image: DNS resolution failed for %s: %s", hostname, e)
        raise HTTPException(status_code=400, detail="Could not resolve hostname")

    if any(resolved_ip in net for net in _PRIVATE_NETWORKS):
        raise HTTPException(status_code=400, detail="URL resolves to a private address")

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            verify=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
        ) as client:
            resp = await client.get(req.url)
    except httpx.TimeoutException:
        raise HTTPException(status_code=502, detail="Request timed out fetching the image URL")
    except httpx.TooManyRedirects:
        raise HTTPException(status_code=502, detail="Too many redirects following the image URL")
    except httpx.SSLError as e:
        logger.warning("fetch-image: SSL error for %s: %s", _safe_log_url(req.url), e)
        raise HTTPException(status_code=502, detail="SSL certificate error fetching the image URL")
    except Exception as e:
        logger.warning("fetch-image: connection error for %s: %s", _safe_log_url(req.url), e)
        raise HTTPException(status_code=502, detail="Could not connect to the image URL")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Image server returned HTTP {resp.status_code}",
        )

    content_type = resp.headers.get("content-type", "").split(";")[0].strip()
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"URL does not point to an image (content-type: {content_type or 'unknown'})",
        )

    data = resp.content
    if len(data) > MAX_FETCH_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image exceeds 10 MB size limit")

    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_IMAGE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Image format not supported: {img.format}",
            )
        img.thumbnail((1000, 1000))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("fetch-image: PIL decode failed for %s: %s", _safe_log_url(req.url), e)
        raise HTTPException(status_code=400, detail="Could not decode the image data")

    return {"image_b64": b64, "mime_type": "image/jpeg"}


@app.post("/api/ai-autofill")
@limiter.limit("10/minute")
async def ai_autofill(request: Request, req: AiAutofillRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI autofill is not configured. Add a GEMINI_API_KEY to the server environment.",
        )

    prompt = f"""You are a music metadata expert with comprehensive knowledge of music releases worldwide, including K-pop, J-pop, and international music.

Your primary reference sources are **Apple Music** and **Spotify** — use the metadata exactly as it appears on those platforms (title casing, artist name formatting, album name, track number, release year, genre). Cross-reference both services to corroborate the information before returning it.

Given information about a YouTube video download, return clean and accurate ID3 tag values as JSON.

Current metadata:
- YouTube title: "{req.youtube_title}"
- Title: "{req.title}"
- Artist: "{req.artist}"
- Album: "{req.album}"
- Album Artist: "{req.album_artist}"
- Year: "{req.year}"
- Track Number: "{req.track_number}"
- Genre: "{req.genre}"

Instructions — follow each one carefully:

1. **title**: Always return a clean song title using this strict priority order:
   a. Official English title as listed on Apple Music / Spotify (e.g. "Are You Alive" not "깨어")
   b. Official romanized title if no English title exists on those platforms (e.g. "Kkaeeo")
   c. Unofficial/best-effort romanization as a last resort
   In all cases, strip ALL YouTube noise: "(Official Video)", "[Official Audio]", "(Lyric Video)", "(4K)", "HD", "MV", "M/V", "Official MV", "Official", "(HQ)", "(Performance Video)", "(Visualizer)", "(Live)", etc. Keep featuring artists.

2. **album**: Use the official album or EP name exactly as it appears on Apple Music or Spotify. Return "" only if the track is not found on either platform.

3. **track_number**: The track's position on the album as listed on Apple Music or Spotify, in the format "N" or "N/Total" (e.g. "3" or "3/12"). Return "" only if unknown.

4. **artist / album_artist**: Use the exact artist name formatting from Apple Music or Spotify (e.g. correct capitalisation, spacing). Return unchanged if already correct.

5. **year**: The original release year as a 4-digit string, matching Apple Music or Spotify. Prefer single/album release date over YouTube upload date. Return "" if unknown.

6. **genre**: Use the genre tag from Apple Music if available (e.g. "K-Pop", "Synth-pop", "Hip-Hop/Rap"). Return "" if unknown.

7. **album_art_url**: Return "" — do not provide image URLs.

Return ONLY a JSON object with exactly these keys: title, artist, album, album_artist, year, track_number, genre, album_art_url. No explanation."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "tools": [{"google_search": {}}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 2048,
                    },
                },
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=502, detail="AI request timed out")
    except Exception:
        logger.exception("ai-autofill: network error calling Gemini")
        raise HTTPException(status_code=502, detail="Failed to connect to AI service")

    if resp.status_code in (401, 403):
        raise HTTPException(
            status_code=503,
            detail="AI autofill is not configured (invalid API key)",
        )
    if resp.status_code != 200:
        logger.warning("ai-autofill: Gemini returned %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail=f"AI service error ({resp.status_code})")

    try:
        data = resp.json()
        logger.info("ai-autofill: full Gemini response: %s", json.dumps(data, ensure_ascii=False))

        candidate = data["candidates"][0]
        finish_reason = candidate.get("finishReason", "")
        logger.info("ai-autofill: finishReason=%s", finish_reason)

        content = candidate.get("content", {})
        parts = content.get("parts")

        if not parts:
            # Some finish reasons (e.g. SAFETY, RECITATION) return no parts
            logger.warning("ai-autofill: no parts in response — finishReason=%s content=%s", finish_reason, content)
            raise ValueError(f"Gemini returned no content parts (finishReason={finish_reason})")

        # Thinking models prepend a thought part — skip it and use the first real text part
        text = next(
            (p["text"] for p in parts if not p.get("thought") and "text" in p),
            None,
        )
        if text is None:
            raise ValueError("No usable text part found in Gemini response")

        logger.info("ai-autofill: raw text from Gemini: %r", text)

        # Strip markdown code fences the model may wrap around the JSON
        text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text.strip())
        # Fallback: extract the first {...} block if still not clean JSON
        if not text.startswith("{"):
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                text = m.group(0)
        # Gemini sometimes escapes single quotes as \' which is invalid JSON
        text = text.replace("\\'", "'")

        logger.info("ai-autofill: cleaned text before json.loads: %r", text)
        suggestions = json.loads(text)
    except Exception:
        logger.exception("ai-autofill: failed to parse Gemini response")
        raise HTTPException(status_code=502, detail="Failed to parse AI response")

    def _s(val, max_len: int = 500) -> str:
        return str(val).strip()[:max_len] if val else ""

    raw_year = _s(suggestions.get("year"), 4)
    year = raw_year if re.match(r"^\d{4}$", raw_year) else ""

    raw_track = _s(suggestions.get("track_number"), 20)
    track_number = raw_track if re.match(r"^\d+(/\d+)?$", raw_track) else ""

    return {
        "title": _s(suggestions.get("title"), 500),
        "artist": _s(suggestions.get("artist"), 500),
        "album": _s(suggestions.get("album"), 500),
        "album_artist": _s(suggestions.get("album_artist"), 500),
        "year": year,
        "track_number": track_number,
        "genre": _s(suggestions.get("genre"), 100),
        "album_art_url": _s(suggestions.get("album_art_url"), 2048),
    }


@app.post("/api/cancel/{file_id}")
@limiter.limit("20/minute")
async def cancel_download(request: Request, file_id: str):
    if not _validate_file_id(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")
    _cleanup_files(file_id)
    return {"status": "ok"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve the React SPA — only active when the production build is present.
# API routes registered above take precedence because they are evaluated first.
if FRONTEND_DIST.is_dir():
    # Serve individual static asset files (JS/CSS chunks, images, fonts…)
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="static-assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Return a static file if it exists, otherwise fall back to index.html for SPA routing."""
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
