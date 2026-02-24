#!/usr/bin/env bash
set -eo pipefail
set -m  # Monitor mode: each background job gets its own process group

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

BACKEND_PID=''
FRONTEND_PID=''

cleanup() {
  echo -e "\n${YELLOW}Shutting down…${RESET}"
  # kill -- -PID sends SIGTERM to the entire process group (uvicorn/node + sed + children).
  # This works because set -m gives each { } & job its own group with PGID == $!.
  [ -n "$BACKEND_PID"  ] && kill -- -"$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill -- -"$FRONTEND_PID" 2>/dev/null || true
  # Safety net: forcibly free port 8000 in case anything survived the group kill.
  fuser -k 8000/tcp 2>/dev/null || true
  wait 2>/dev/null || true
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

# Wrap in { } & so the subshell is the process group leader ($! == PGID).
# The pipe to sed stays inside the group, so kill -- -$PID wipes everything.
{
  uvicorn main:app --port 8000 2>&1 | sed "s/^/$(echo -e "${CYAN}[backend]${RESET}") /"
} &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
echo -e "${GREEN}[frontend]${RESET} Starting Vite dev server…"
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo -e "${RED}Error:${RESET} frontend/node_modules not found. Run: cd frontend && npm install"
  exit 1
fi

cd "$ROOT/frontend"
{
  npm run dev 2>&1 | sed "s/^/$(echo -e "${GREEN}[frontend]${RESET}") /"
} &
FRONTEND_PID=$!

echo -e "\n  ${CYAN}Backend${RESET}  → http://localhost:8000"
echo -e "  ${GREEN}Frontend${RESET} → http://localhost:5173"
echo -e "\n  Press ${YELLOW}Ctrl+C${RESET} to stop both servers.\n"

wait
