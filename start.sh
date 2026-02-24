#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down…${RESET}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo -e "${GREEN}Done.${RESET}"
}
trap cleanup EXIT INT TERM

echo -e "${CYAN}Starting YT to MP3…${RESET}\n"

# ── Backend ──────────────────────────────────────────────────────────────────
echo -e "${CYAN}[backend]${RESET} Activating virtual environment…"
if [ ! -d "$ROOT/backend/venv" ]; then
  echo -e "${RED}Error:${RESET} backend/venv not found. Run: cd backend && python3 -m venv venv && pip install -r requirements.txt"
  exit 1
fi

source "$ROOT/backend/venv/bin/activate"
cd "$ROOT/backend"
uvicorn main:app --port 8000 2>&1 | sed "s/^/$(echo -e "${CYAN}[backend]${RESET}") /" &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
echo -e "${GREEN}[frontend]${RESET} Starting Vite dev server…"
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo -e "${RED}Error:${RESET} frontend/node_modules not found. Run: cd frontend && npm install"
  exit 1
fi

cd "$ROOT/frontend"
npm run dev 2>&1 | sed "s/^/$(echo -e "${GREEN}[frontend]${RESET}") /" &
FRONTEND_PID=$!

echo -e "\n  ${CYAN}Backend${RESET}  → http://localhost:8000"
echo -e "  ${GREEN}Frontend${RESET} → http://localhost:5173"
echo -e "\n  Press ${YELLOW}Ctrl+C${RESET} to stop both servers.\n"

wait "$BACKEND_PID" "$FRONTEND_PID"
