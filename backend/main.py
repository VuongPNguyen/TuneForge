import os
import uuid
import json
import base64
import asyncio
import shutil
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import yt_dlp
from mutagen.mp3 import MP3
from mutagen.id3 import (
    ID3, TIT2, TPE1, TALB, TPE2, TDRC, TRCK, TCON, APIC, ID3NoHeaderError
)
from PIL import Image
import io

TEMP_DIR = Path(__file__).parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

# Clean up temp files older than 1 hour on startup
def cleanup_old_files():
    import time
    now = time.time()
    for f in TEMP_DIR.iterdir():
        if f.is_file() and (now - f.stat().st_mtime) > 3600:
            f.unlink(missing_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_old_files()
    yield


app = FastAPI(title="YT to MP3 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DownloadRequest(BaseModel):
    url: str
    bitrate: int = 256


class ID3Tags(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    album_artist: Optional[str] = None
    year: Optional[str] = None
    track_number: Optional[str] = None
    genre: Optional[str] = None
    album_art_base64: Optional[str] = None


class SaveRequest(BaseModel):
    file_id: str
    tags: ID3Tags
    filename: str


VALID_BITRATES = {96, 128, 256, 320}


@app.post("/api/download")
async def download_video(req: DownloadRequest):
    if req.bitrate not in VALID_BITRATES:
        raise HTTPException(status_code=400, detail=f"Bitrate must be one of {sorted(VALID_BITRATES)}")

    file_id = str(uuid.uuid4())
    output_path = TEMP_DIR / f"{file_id}.mp3"
    info_path = TEMP_DIR / f"{file_id}.json"

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
        "quiet": True,
        "no_warnings": True,
    }

    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: _download(req.url, ydl_opts))
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    if not output_path.exists():
        raise HTTPException(status_code=500, detail="MP3 file was not created")

    # Extract auto-populated metadata from YouTube
    thumbnail_b64 = None
    if info.get("thumbnail"):
        try:
            import urllib.request
            thumb_data = await loop.run_in_executor(
                None, lambda: urllib.request.urlopen(info["thumbnail"], timeout=5).read()
            )
            # Resize thumbnail to a reasonable size
            img = Image.open(io.BytesIO(thumb_data))
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

    info_path.write_text(json.dumps(metadata))

    return metadata


def _download(url: str, opts: dict) -> dict:
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return info or {}


@app.post("/api/save")
async def save_with_tags(req: SaveRequest, background_tasks: BackgroundTasks):
    mp3_path = TEMP_DIR / f"{req.file_id}.mp3"
    info_path = TEMP_DIR / f"{req.file_id}.json"

    if not mp3_path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")

    # Write ID3 tags
    try:
        try:
            tags = ID3(str(mp3_path))
        except ID3NoHeaderError:
            tags = ID3()

        tags.delall("TIT2")
        tags.delall("TPE1")
        tags.delall("TALB")
        tags.delall("TPE2")
        tags.delall("TDRC")
        tags.delall("TRCK")
        tags.delall("TCON")
        tags.delall("APIC")

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
            art_data = base64.b64decode(t.album_art_base64)
            # Ensure it's a valid JPEG
            img = Image.open(io.BytesIO(art_data))
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write tags: {str(e)}")

    safe_filename = _safe_filename(req.filename or "download") + ".mp3"

    # Schedule cleanup after response is sent
    background_tasks.add_task(_cleanup_files, req.file_id)

    return FileResponse(
        path=str(mp3_path),
        media_type="audio/mpeg",
        filename=safe_filename,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


def _safe_filename(name: str) -> str:
    keep = set(" abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.()")
    sanitized = "".join(c if c in keep else "_" for c in name).strip()
    return sanitized[:100] or "download"


def _cleanup_files(file_id: str):
    for ext in [".mp3", ".json", ".webm", ".m4a", ".opus"]:
        path = TEMP_DIR / f"{file_id}{ext}"
        path.unlink(missing_ok=True)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
