# YT to MP3

A clean, modern web application for converting YouTube videos to MP3 with full ID3 tag support.

---

## Features

- **YouTube to MP3 conversion** — Paste any YouTube video URL and get a high-quality MP3 download
- **Bitrate selection** — Choose from 96, 128, 256, or 320 kb/s (default: 256 kb/s)
- **ID3 tag editor** — Customize your file's metadata before downloading:
  - Title
  - Artist
  - Album
  - Album Artist
  - Year
  - Track Number
  - Genre
  - Album Artwork (auto-populated from the YouTube thumbnail, or upload your own image)
- **Auto-populated metadata** — Title, artist, year, and thumbnail are automatically pulled from the video's metadata
- **Clean filename** — The output file is named `Artist - Title.mp3` automatically

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19 + TypeScript + Vite        |
| Styling  | Tailwind CSS v4                     |
| Backend  | Python 3 + FastAPI                  |
| Download | yt-dlp                              |
| Audio    | FFmpeg                              |
| Tagging  | mutagen                             |

---

## Usage

1. Paste a YouTube video URL into the input field
2. Select your desired audio bitrate
3. Click **Convert to MP3** and wait for processing
4. Review and edit the auto-populated ID3 tags
5. Optionally upload a custom album artwork image
6. Click **Save & Download MP3** — the file will be saved to your downloads folder

---

## Screenshots

> _Screenshots coming soon_

---

## Legal Notice

This tool is intended for **personal use only**. Please respect copyright law and YouTube's [Terms of Service](https://www.youtube.com/t/terms). Only download content you have the right to download.

---

## License

MIT
