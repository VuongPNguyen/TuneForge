# Developer Notes — YT to MP3

> **PRIVATE** — This file is for internal developer reference only. Do not publish or commit to a public repository.

---

## Quick Reference

### Backend

```bash
# Navigate to backend
cd backend

# Activate virtual environment
source venv/bin/activate

# Install / sync packages
pip install -r requirements.txt

# Run development server (hot reload)
uvicorn main:app --reload --port 8000

# Run in production mode
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend

```bash
# Navigate to frontend
cd frontend

# Install / sync packages
npm install

# Run development server (proxies /api → localhost:8000)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Type-check without building
npx tsc --noEmit
```

### Running Both Together (Recommended)

```bash
./start.sh
```

Starts the backend and frontend in parallel, prefixes their output with color-coded labels, and shuts both down cleanly on `Ctrl+C`.

### Running Separately (Development)

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend && npm run dev
```

Frontend will be available at `http://localhost:5173`.
The Vite dev server proxies all `/api/*` requests to `http://localhost:8000`.

---

## System Requirements

| Dependency | Version  | Notes                                      |
|------------|----------|--------------------------------------------|
| Python     | 3.12+    | Installed via `apt`                        |
| Node.js    | 22.x     | Installed via NodeSource                   |
| npm        | 10.x     | Bundled with Node.js                       |
| FFmpeg     | 6.x      | Required for audio conversion (`apt`)      |
| yt-dlp     | 2025.x   | Managed via `pip` in backend venv          |

---

## Project Structure

```
YoutubeToMP3/
├── backend/
│   ├── main.py              # FastAPI app — all routes and logic
│   ├── requirements.txt     # Python dependencies
│   ├── venv/                # Python virtual environment (not committed)
│   └── temp/                # Temporary MP3 files (auto-cleaned, not committed)
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Root component, step state machine
│   │   ├── api.ts           # Fetch wrappers for backend API
│   │   ├── types.ts         # Shared TypeScript interfaces
│   │   ├── index.css        # Tailwind entry point + theme tokens
│   │   └── components/
│   │       ├── DownloadForm.tsx   # Step 1: URL input + bitrate selection
│   │       ├── LoadingState.tsx   # Step 2: Animated conversion progress
│   │       ├── TagEditor.tsx      # Step 3: ID3 tag form + album art
│   │       └── ErrorAlert.tsx     # Dismissable error banner
│   ├── index.html
│   ├── vite.config.ts       # Vite + Tailwind + /api proxy config
│   ├── package.json
│   └── tsconfig.json
├── README.md                # Public-facing documentation
└── DEV.md                   # This file (private)
```

---

## API Reference

### `POST /api/download`

Downloads a YouTube video as MP3 and stores it in `backend/temp/`.

**Request body:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "bitrate": 256
}
```

**Response:**
```json
{
  "file_id": "uuid-string",
  "title": "Track Title",
  "artist": "Artist Name",
  "album": "",
  "album_artist": "Artist Name",
  "year": "2024",
  "track_number": "",
  "genre": "",
  "thumbnail_b64": "base64-encoded-jpeg-or-null",
  "duration": 240,
  "webpage_url": "https://..."
}
```

---

### `POST /api/save`

Writes ID3 tags to the temp MP3 and returns the file as a download.
Temp files are cleaned up automatically after the response is sent.

**Request body:**
```json
{
  "file_id": "uuid-string",
  "filename": "Artist - Title",
  "tags": {
    "title": "Track Title",
    "artist": "Artist",
    "album": "Album",
    "album_artist": "Album Artist",
    "year": "2024",
    "track_number": "1",
    "genre": "Electronic",
    "album_art_base64": "base64-jpeg-or-null"
  }
}
```

**Response:** Binary MP3 file (`audio/mpeg`)

---

### `GET /api/health`

Returns `{ "status": "ok" }`. Used for uptime monitoring.

---

## Environment Notes

- Temp files are stored in `backend/temp/` and are cleaned up:
  - After each successful `/api/save` request (background task)
  - On server startup (files older than 1 hour)
- CORS is currently restricted to `localhost:5173`. Update `allow_origins` in `main.py` before deploying to production.
- The backend uses `ID3v2.3` tags for maximum compatibility.

---

## Changelog

### v0.1.0 — 2026-02-24

- Initial release
- YouTube URL input with validation
- Bitrate selection: 96 / 128 / 256 (default) / 320 kb/s
- Auto-populated ID3 metadata from yt-dlp (title, artist, year, thumbnail)
- ID3 tag editor: Title, Artist, Album, Album Artist, Year, Track Number, Genre
- Album artwork support (auto-populated from YouTube thumbnail, custom upload)
- Animated conversion loading screen
- Automatic temp file cleanup
- Output filename: `Artist - Title.mp3`
- Dark-themed UI built with React + TypeScript + Vite + Tailwind CSS v4
- FastAPI backend with yt-dlp + FFmpeg + mutagen
