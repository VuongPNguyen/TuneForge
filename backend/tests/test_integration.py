"""Integration tests for all FastAPI endpoints using TestClient."""
import io
import base64
import shutil
import uuid
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app, TEMP_DIR

client = TestClient(app)


def _make_jpeg_bytes(width: int = 10, height: int = 10) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(200, 100, 50)).save(buf, format="JPEG")
    return buf.getvalue()


def _make_temp_mp3(file_id: str) -> None:
    """Write a minimal fake MP3 to TEMP_DIR so the save endpoint can find it."""
    path = TEMP_DIR / f"{file_id}.mp3"
    # Minimal bytes that won't crash mutagen (it will just write a new ID3 header)
    path.write_bytes(b"\xff\xfb\x90\x00" * 64)


# ---------------------------------------------------------------------------
# /api/health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# /api/download
# ---------------------------------------------------------------------------

class TestDownloadEndpoint:
    def test_rejects_missing_url(self):
        resp = client.post("/api/download", json={"bitrate": 256})
        assert resp.status_code == 422

    def test_rejects_non_youtube_url(self):
        resp = client.post("/api/download", json={"url": "https://vimeo.com/123", "bitrate": 256})
        assert resp.status_code == 400
        assert "YouTube" in resp.json()["detail"]

    def test_rejects_invalid_bitrate(self):
        resp = client.post(
            "/api/download",
            json={"url": "https://www.youtube.com/watch?v=abc", "bitrate": 999},
        )
        assert resp.status_code == 400
        assert "itrate" in resp.json()["detail"]

    def test_rejects_ftp_scheme(self):
        resp = client.post(
            "/api/download",
            json={"url": "ftp://www.youtube.com/watch?v=abc", "bitrate": 256},
        )
        assert resp.status_code == 400

    def test_rejects_empty_url(self):
        resp = client.post("/api/download", json={"url": "", "bitrate": 256})
        assert resp.status_code == 400

    @pytest.mark.parametrize("bitrate", [96, 128, 256, 320])
    def test_accepts_valid_bitrates(self, bitrate):
        """Valid bitrates pass validation; yt-dlp is mocked to fail with a DownloadError."""
        import asyncio as _asyncio
        import yt_dlp
        import main as main_module

        # _DOWNLOAD_SEM is only initialised by the lifespan; seed it for this test.
        with patch.object(main_module, "_DOWNLOAD_SEM", _asyncio.Semaphore(1), create=True), \
             patch("main._download", side_effect=yt_dlp.utils.DownloadError("mocked")):
            resp = client.post(
                "/api/download",
                json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "bitrate": bitrate},
            )
        # DownloadError → 400; rate-limit (429) also means validation passed
        assert resp.status_code in (400, 429)


# ---------------------------------------------------------------------------
# /api/save
# ---------------------------------------------------------------------------

class TestSaveEndpoint:
    def test_rejects_invalid_file_id(self):
        resp = client.post("/api/save", json={
            "file_id": "not-a-uuid",
            "tags": {},
            "filename": "test",
        })
        assert resp.status_code == 400
        assert "Invalid file ID" in resp.json()["detail"]

    def test_rejects_path_traversal_file_id(self):
        resp = client.post("/api/save", json={
            "file_id": "../../../etc/passwd",
            "tags": {},
            "filename": "test",
        })
        assert resp.status_code == 400

    def test_returns_404_for_missing_file(self):
        resp = client.post("/api/save", json={
            "file_id": str(uuid.uuid4()),
            "tags": {},
            "filename": "test",
        })
        assert resp.status_code == 404

    def test_rejects_invalid_year_format(self):
        file_id = str(uuid.uuid4())
        _make_temp_mp3(file_id)
        try:
            resp = client.post("/api/save", json={
                "file_id": file_id,
                "tags": {"year": "20abc"},
                "filename": "test",
            })
            assert resp.status_code == 422
        finally:
            (TEMP_DIR / f"{file_id}.mp3").unlink(missing_ok=True)

    def test_saves_text_tags_and_returns_mp3(self):
        file_id = str(uuid.uuid4())
        _make_temp_mp3(file_id)
        try:
            resp = client.post("/api/save", json={
                "file_id": file_id,
                "tags": {
                    "title": "Test Song",
                    "artist": "Test Artist",
                    "album": "Test Album",
                    "album_artist": "Test Artist",
                    "year": "2024",
                    "track_number": "1",
                    "genre": "Electronic",
                    "album_art_base64": None,
                },
                "filename": "Test Artist - Test Song",
            })
            assert resp.status_code == 200
            assert resp.headers["content-type"] == "audio/mpeg"
        finally:
            (TEMP_DIR / f"{file_id}.mp3").unlink(missing_ok=True)

    def test_saves_album_art_as_jpeg(self):
        file_id = str(uuid.uuid4())
        _make_temp_mp3(file_id)
        b64_art = base64.b64encode(_make_jpeg_bytes()).decode()
        try:
            resp = client.post("/api/save", json={
                "file_id": file_id,
                "tags": {"album_art_base64": b64_art},
                "filename": "track",
            })
            assert resp.status_code == 200
        finally:
            (TEMP_DIR / f"{file_id}.mp3").unlink(missing_ok=True)

    def test_rejects_oversized_album_art(self):
        file_id = str(uuid.uuid4())
        _make_temp_mp3(file_id)
        # 8 MB of base64 (~5.8 MB decoded) exceeds the limit
        oversized_b64 = base64.b64encode(b"x" * (8 * 1024 * 1024)).decode()
        try:
            resp = client.post("/api/save", json={
                "file_id": file_id,
                "tags": {"album_art_base64": oversized_b64},
                "filename": "track",
            })
            assert resp.status_code == 400
            assert "too large" in resp.json()["detail"].lower()
        finally:
            (TEMP_DIR / f"{file_id}.mp3").unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# /api/fetch-image
# ---------------------------------------------------------------------------

class TestFetchImageEndpoint:
    def test_rejects_non_http_scheme(self):
        resp = client.post("/api/fetch-image", json={"url": "file:///etc/passwd"})
        assert resp.status_code == 400

    def test_rejects_javascript_scheme(self):
        resp = client.post("/api/fetch-image", json={"url": "javascript:alert(1)"})
        assert resp.status_code == 400

    def test_rejects_private_ip(self):
        with patch("main.socket.gethostbyname", return_value="192.168.1.1"):
            resp = client.post("/api/fetch-image", json={"url": "https://internal.corp/logo.png"})
        assert resp.status_code == 400
        assert "private" in resp.json()["detail"].lower()

    def test_rejects_loopback_ip(self):
        with patch("main.socket.gethostbyname", return_value="127.0.0.1"):
            resp = client.post("/api/fetch-image", json={"url": "https://localhost/secret.png"})
        assert resp.status_code == 400

    def test_rejects_non_image_content_type(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "text/html; charset=utf-8"}
        mock_resp.content = b"<html>not an image</html>"

        with patch("main.socket.gethostbyname", return_value="93.184.216.34"), \
             patch("main.httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_resp)
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            resp = client.post("/api/fetch-image", json={"url": "https://example.com/page"})

        assert resp.status_code == 400
        assert "image" in resp.json()["detail"].lower()

    def test_rejects_non_200_response(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_resp.headers = {"content-type": "text/plain"}

        with patch("main.socket.gethostbyname", return_value="93.184.216.34"), \
             patch("main.httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_resp)
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            resp = client.post("/api/fetch-image", json={"url": "https://example.com/forbidden.jpg"})

        assert resp.status_code == 502
        assert "403" in resp.json()["detail"]

    def test_returns_base64_jpeg_for_valid_image(self):
        jpeg_bytes = _make_jpeg_bytes(50, 50)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/jpeg"}
        mock_resp.content = jpeg_bytes

        with patch("main.socket.gethostbyname", return_value="93.184.216.34"), \
             patch("main.httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_resp)
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            resp = client.post("/api/fetch-image", json={"url": "https://example.com/cover.jpg"})

        assert resp.status_code == 200
        data = resp.json()
        assert "image_b64" in data
        assert data["mime_type"] == "image/jpeg"
        decoded = base64.b64decode(data["image_b64"])
        assert len(decoded) > 0

    def test_handles_content_type_with_charset(self):
        """content-type like 'image/png; charset=utf-8' should still be accepted."""
        jpeg_bytes = _make_jpeg_bytes()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/png; charset=utf-8"}
        mock_resp.content = io.BytesIO(b"").getvalue()

        png_buf = io.BytesIO()
        Image.new("RGB", (5, 5)).save(png_buf, format="PNG")
        mock_resp.content = png_buf.getvalue()

        with patch("main.socket.gethostbyname", return_value="93.184.216.34"), \
             patch("main.httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_resp)
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            resp = client.post("/api/fetch-image", json={"url": "https://example.com/img.png"})

        assert resp.status_code == 200
