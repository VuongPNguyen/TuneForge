# ── Stage 1: build React frontend ─────────────────────────────────────────
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: runtime ───────────────────────────────────────────────────────
FROM python:3.12-slim

# FFmpeg is required by yt-dlp for audio extraction
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies before copying source so this layer is cached
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy pre-built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Directories that must exist at startup:
#   backend/temp — scratch space for in-flight MP3 files (ephemeral)
#   data         — mounted as a Fly.io persistent volume for SQLite
RUN mkdir -p backend/temp data

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
