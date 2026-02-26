#!/usr/bin/env bash
set -eo pipefail

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

killed=0

kill_port() {
  local port="$1"
  local label="$2"
  if fuser "$port/tcp" &>/dev/null 2>&1; then
    fuser -k "$port/tcp" 2>/dev/null || true
    echo -e "  ${GREEN}✓${RESET} Stopped $label (port $port)"
    killed=$((killed + 1))
  else
    echo -e "  ${YELLOW}–${RESET} $label (port $port) was not running"
  fi
}

kill_by_name() {
  local pattern="$1"
  local label="$2"
  # pgrep returns exit code 1 when nothing matches; suppress that
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    echo -e "  ${GREEN}✓${RESET} Killed $label processes"
    killed=$((killed + 1))
  fi
}

echo -e "${YELLOW}Stopping servers…${RESET}\n"

kill_port 8000 "backend (uvicorn)"
kill_port 5173 "frontend (Vite)"

# Belt-and-suspenders: catch any stragglers not bound to the expected ports
kill_by_name "uvicorn main:app" "uvicorn"
kill_by_name "vite" "Vite"

echo ""
if [ "$killed" -gt 0 ]; then
  echo -e "${GREEN}Done.${RESET}"
else
  echo -e "${YELLOW}No servers were running.${RESET}"
fi
