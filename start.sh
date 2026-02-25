#!/usr/bin/env bash
# Convenience shim — the canonical script now lives in scripts/start.sh
exec "$(dirname "${BASH_SOURCE[0]}")/scripts/start.sh" "$@"
