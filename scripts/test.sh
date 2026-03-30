#!/usr/bin/env bash
# Run the full test suite: backend (unit + integration) and frontend (unit + E2E).
#
# Usage:
#   ./scripts/test.sh           # backend + frontend unit tests (no E2E)
#   ./scripts/test.sh --e2e     # all of the above + Playwright E2E
#   ./scripts/test.sh --only-e2e  # Playwright E2E only (requires dev server on :5173)
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

RUN_E2E=false
ONLY_E2E=false

for arg in "$@"; do
  case "$arg" in
    --e2e)      RUN_E2E=true ;;
    --only-e2e) ONLY_E2E=true ;;
    *)
      echo -e "${RED}Unknown option: $arg${RESET}"
      echo "Usage: $0 [--e2e] [--only-e2e]"
      exit 1
      ;;
  esac
done

PASS=0
FAIL=0
SKIP=0

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

section() { echo -e "\n${BOLD}${CYAN}━━━  $1  ━━━${RESET}"; }

run_suite() {
  local label="$1"; shift
  echo -e "${YELLOW}▶ $label${RESET}"
  if "$@"; then
    echo -e "${GREEN}✔ $label passed${RESET}"
    (( PASS++ )) || true
  else
    echo -e "${RED}✘ $label failed${RESET}"
    (( FAIL++ )) || true
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Backend
# ─────────────────────────────────────────────────────────────────────────────

if [ "$ONLY_E2E" = false ]; then
  section "Backend tests  (pytest)"

  if [ ! -d "$ROOT/backend/venv" ]; then
    echo -e "${RED}Error:${RESET} backend/venv not found."
    echo "  Fix: cd backend && python3 -m venv venv && pip install -r requirements.txt"
    exit 1
  fi

  run_suite "Backend unit & integration" \
    bash -c "source '$ROOT/backend/venv/bin/activate' \
             && cd '$ROOT/backend' \
             && python -m pytest tests/ -v"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Frontend unit + component tests
# ─────────────────────────────────────────────────────────────────────────────

if [ "$ONLY_E2E" = false ]; then
  section "Frontend unit & component tests  (vitest)"

  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo -e "${RED}Error:${RESET} frontend/node_modules not found."
    echo "  Fix: cd frontend && npm install"
    exit 1
  fi

  run_suite "Frontend unit & component" \
    bash -c "cd '$ROOT/frontend' && npm test"
fi

# ─────────────────────────────────────────────────────────────────────────────
# E2E tests (opt-in)
# ─────────────────────────────────────────────────────────────────────────────

if [ "$RUN_E2E" = true ] || [ "$ONLY_E2E" = true ]; then
  section "E2E tests  (playwright)"

  # Check the dev server is reachable before attempting to run Playwright.
  if ! curl -sf http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠  Dev server not detected on http://localhost:5173${RESET}"
    echo -e "   Start it first with:  ${CYAN}./scripts/start.sh${RESET}"
    echo -e "   Skipping E2E tests.\n"
    (( SKIP++ )) || true
  else
    run_suite "E2E (Playwright)" \
      bash -c "cd '$ROOT/frontend' && npm run test:e2e"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${BOLD}━━━  Results  ━━━${RESET}"
[ "$PASS" -gt 0 ] && echo -e "  ${GREEN}✔ Passed: $PASS${RESET}"
[ "$SKIP" -gt 0 ] && echo -e "  ${YELLOW}⊘ Skipped: $SKIP${RESET}"
[ "$FAIL" -gt 0 ] && echo -e "  ${RED}✘ Failed: $FAIL${RESET}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
