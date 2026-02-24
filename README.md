# YT to MP3

A self-hosted web application for converting YouTube videos to MP3 with a built-in ID3 tag editor. Paste a URL, pick a bitrate, tweak the metadata, and download a properly tagged MP3 — all in a few clicks.

---

## Features

- **One-step conversion** — Paste any YouTube URL and get an MP3 in seconds
- **Bitrate selection** — 96, 128, 256 (default), or 320 kb/s
- **Auto-populated ID3 tags** — Title, artist, year, and album artwork are pulled directly from the video's metadata
- **Full tag editor** — Edit Title, Artist, Album, Album Artist, Year, Track Number, and Genre before downloading
- **Album artwork** — Auto-fetched from the YouTube thumbnail; replace it with any image from your disk or a URL
- **Clean filenames** — Output is named `Artist - Title.mp3` automatically
- **No accounts, no tracking** — Runs entirely on your own machine

---

## Self-Hosting

### Requirements

| Dependency | Version | Install          |
|------------|---------|------------------|
| Python     | 3.12+   | `apt install python3` |
| Node.js    | 22.x    | [nodejs.org](https://nodejs.org) |
| FFmpeg     | 6.x+    | `apt install ffmpeg` |

### Setup

**1. Clone the repository**

```bash
git clone https://github.com/your-username/YoutubeToMP3.git
cd YoutubeToMP3
```

**2. Install backend dependencies**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

**3. Install frontend dependencies**

```bash
cd frontend
npm install
cd ..
```

**4. Configure environment (optional)**

Copy `.env.example` to `.env` and set your allowed origins if you're deploying behind a domain:

```bash
cp .env.example .env
# Edit .env → set CORS_ORIGINS=https://yourdomain.com
```

### Running

Start both servers with a single command:

```bash
./start.sh
```

Then open **http://localhost:5173** in your browser.

> To start the servers individually, see the developer notes in `DEV.md`.

---

## How It Works

```
Browser  →  Vite dev server (port 5173)
               │
               └─ /api/*  →  FastAPI backend (port 8000)
                                  │
                                  └─ yt-dlp + FFmpeg → MP3
                                     mutagen → ID3 tags
```

1. The frontend proxies all `/api` requests to the FastAPI backend
2. The backend downloads the audio stream via **yt-dlp**, converts it to MP3 with **FFmpeg**, and stores it temporarily
3. You review and edit the metadata in the browser, then click **Save & Download**
4. The backend writes the ID3 tags with **mutagen** and streams the file back; the temp file is deleted immediately after

---

## Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | React 19 + TypeScript   |
| Build    | Vite + Tailwind CSS v4  |
| Backend  | Python 3 + FastAPI      |
| Download | yt-dlp                  |
| Audio    | FFmpeg                  |
| Tagging  | mutagen                 |

---

## Legal Notice

This tool is intended for **personal use only**. Only download content you have the right to use. Please respect copyright law and YouTube's [Terms of Service](https://www.youtube.com/t/terms).

---

## License

MIT
