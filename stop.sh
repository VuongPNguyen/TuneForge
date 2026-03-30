#!/usr/bin/env bash
# Convenience shim — the canonical script now lives in scripts/stop.sh
exec "$(dirname "${BASH_SOURCE[0]}")/scripts/stop.sh" "$@"
