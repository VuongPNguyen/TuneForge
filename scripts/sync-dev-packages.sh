#!/usr/bin/env bash
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

#
# Default behavior:
# - If ffmpeg/ffprobe are missing, attempt to install them automatically.
# - Set AUTO_INSTALL_FFMPEG=0 to only print instructions and fail instead.
#
AUTO_INSTALL_FFMPEG="${AUTO_INSTALL_FFMPEG:-1}"
INSTALL_MODE=0
if [[ "${1:-}" == "--install-deps" ]]; then
  INSTALL_MODE=1
  shift
fi

need_ffmpeg=0
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  need_ffmpeg=1
fi

if [[ "$need_ffmpeg" == "1" ]]; then
  echo "ffmpeg/ffprobe not found."
  echo "yt-dlp needs ffmpeg for audio extraction."

  if [[ "${AUTO_INSTALL_FFMPEG}" == "1" || "${AUTO_INSTALL_FFMPEG}" == "true" || "${INSTALL_MODE}" == "1" ]]; then
    if ! command -v sudo >/dev/null 2>&1; then
      echo "Cannot auto-install: \`sudo\` not found."
      exit 1
    fi

    # Prompt for credentials if needed (local dev convenience).
    if ! sudo -v; then
      echo "Auto-install failed (sudo permissions). Install manually:"
      echo "  (Debian/Ubuntu) sudo apt-get update && sudo apt-get install -y ffmpeg"
      exit 1
    fi

    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update && sudo apt-get install -y ffmpeg
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y ffmpeg
    elif command -v pacman >/dev/null 2>&1; then
      sudo pacman -S --noconfirm --needed ffmpeg
    else
      echo "Unsupported package manager; install ffmpeg manually."
      exit 1
    fi
  else
    echo
    echo "Auto-install disabled (AUTO_INSTALL_FFMPEG=0). Install manually, then re-run:"
    echo "  (Debian/Ubuntu) sudo apt-get update && sudo apt-get install -y ffmpeg"
    echo "  (Fedora) sudo dnf install -y ffmpeg"
    echo "  (Arch) sudo pacman -S --needed ffmpeg"
    exit 1
  fi
fi

echo "Installing frontend (node)…"
cd "$ROOT/frontend"
if [ -f "$ROOT/frontend/package-lock.json" ]; then
  npm ci
else
  npm install
fi

echo "Installing backend (python)…"
cd "$ROOT"
if [ ! -d "$ROOT/.venv" ]; then
  python3 -m venv .venv
fi

source "$ROOT/.venv/bin/activate"
pip install -r backend/requirements.txt

echo "Done."

