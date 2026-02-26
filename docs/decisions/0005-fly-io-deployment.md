# ADR-0005: Deploy on Fly.io as a single container

**Status:** Accepted
**Date:** 2026-02-25

## Context

The app requires a persistent server process with the following system dependencies:

- **Python 3.12+** and the FastAPI application
- **FFmpeg** for audio conversion (a native binary, not a Python package)
- **yt-dlp** for downloading YouTube audio streams
- **A writable temporary filesystem** for in-flight MP3 files
- **A persistent filesystem** for the SQLite config database (ADR-0004)

These requirements rule out static hosting (GitHub Pages) and serverless platforms (Vercel, Netlify) entirely — serverless functions cannot install native binaries, have execution time limits far shorter than a video download, and have no persistent filesystem.

The deployment target must be free (or near-free for a personal tool), simple to set up, and require no more than 2–3 moving parts.

## Decision

Deploy on **Fly.io** as a single Docker container serving both the FastAPI backend and the pre-built React frontend as static files.

- The React app is built (`npm run build`) inside the Docker image and served by FastAPI from the `dist/` directory.
- FFmpeg is installed in the Dockerfile via `apt-get`.
- A **Fly.io persistent volume** is mounted at `/app/data` to hold the SQLite database.
- The single `fly deploy` command handles all updates.

## Consequences

### Positive
- **One deployment unit** — no separate frontend host needed; the backend serves everything.
- Free tier includes 3 shared-CPU VMs, 160 GB outbound bandwidth/month, and 3 GB of persistent volume storage — sufficient for personal use.
- No cold-start problem (unlike Render's free tier, which suspends after 15 minutes of inactivity).
- `flyctl` CLI is straightforward; deploys are a single command from the project root.
- Persistent volume makes SQLite storage durable across all redeploys (ADR-0004).
- FFmpeg can be installed directly in the Dockerfile with no workarounds.

### Negative / Trade-offs
- Requires learning `flyctl` and writing a `fly.toml` config — small one-time setup cost.
- The free tier limits RAM to 256 MB per VM; FFmpeg conversions are CPU/IO-bound so this is generally sufficient, but very long videos may be tight.
- If the app ever needs horizontal scaling, the single SQLite volume becomes a bottleneck (mitigated by switching to Postgres at that point).

## Alternatives Considered

**Vercel / GitHub Pages** — rejected because neither can run a persistent Python process or install FFmpeg. The frontend could be hosted on Vercel, but the backend has no valid home there.

**Render (free tier)** — rejected because the free tier suspends web services after 15 minutes of inactivity, causing a ~50-second cold start on the next visit. This is a significant UX problem for a download tool where the user expects an immediate response.

**Oracle Cloud Always Free** — viable (two always-free AMD VMs, truly permanent). Rejected as the first choice because it requires more Linux/server administration (Nginx, SSL certificates, systemd or Docker Compose setup) compared to `fly deploy`. Remains a strong fallback if Fly.io pricing changes.

**Self-hosted VPS (DigitalOcean, Hetzner, etc.)** — reliable but not free. Outside the stated constraints.
