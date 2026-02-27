# YT to Music

A self-hosted web application for converting YouTube videos to music files with a built-in ID3 tag editor. Paste a URL, pick a bitrate, tweak the metadata, and download a properly tagged file — all in a few clicks.

---

## Features

- **One-step conversion** — Paste any YouTube URL and get a music file in seconds
- **Bitrate selection** — 96, 128, 256 (default), or 320 kb/s
- **Auto-populated ID3 tags** — Title, artist, year, and album artwork are pulled directly from the video's metadata
- **Full tag editor** — Edit Title, Artist, Album, Album Artist, Year, Track Number, and Genre before downloading
- **Album artwork** — Auto-fetched from the YouTube thumbnail; replace it with any image from your disk or a URL
- **AI Autofill** — One click to look up accurate metadata (title, album, track number, genre, year) from Apple Music / Spotify using Google Gemini; requires a free `GEMINI_API_KEY`
- **Music library** — Save artist name mappings and album records (genre, year, artwork) that autofill automatically on future downloads
- **Music modes** — Smart presets for covers, singles, and albums that sync related fields as you type
- **Cancel / reset** — Start over at any time; temp files are cleaned up on the server immediately
- **Clean filenames** — Output is named `Artist - Title.mp3` automatically (MP3 format)
- **No accounts, no tracking** — Runs entirely on your own machine

---

## How It Works

```
Browser  →  Vite dev server (port 5173)
               │
               └─ /api/*  →  FastAPI backend (port 8000)
                                  │
                                  ├─ yt-dlp + FFmpeg → MP3
                                  ├─ mutagen → ID3 tags
                                  └─ Gemini API → AI Autofill (optional)
```

1. The frontend proxies all `/api` requests to the FastAPI backend
2. The backend downloads the audio stream via **yt-dlp**, converts it to a music file with **FFmpeg**, and stores it temporarily
3. You review and edit the metadata in the browser — optionally using **AI Autofill** to look up accurate tags from Apple Music / Spotify
4. Artist name mappings and saved album records are persisted locally in **IndexedDB** and applied automatically on future downloads
5. Click **Save & Download** — the backend writes the ID3 tags with **mutagen** and streams the music file back; the temp file is deleted immediately after

---

## Tech Stack

| Layer        | Technology                     |
|--------------|--------------------------------|
| Frontend     | React 19 + TypeScript          |
| Build        | Vite + Tailwind CSS v4         |
| Persistence  | IndexedDB (idb)                |
| Backend      | Python 3 + FastAPI             |
| Download     | yt-dlp                         |
| Audio        | FFmpeg                         |
| Tagging      | mutagen                        |
| AI Autofill  | Google Gemini 2.0 Flash (opt.) |

---

## Legal Notice

This tool is intended for **personal use only**. Only download content you have the right to use. Please respect copyright law and YouTube's [Terms of Service](https://www.youtube.com/t/terms).

---

## License

MIT
