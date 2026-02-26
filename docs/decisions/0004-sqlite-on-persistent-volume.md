# ADR-0004: SQLite on a persistent volume for admin config storage

**Status:** Accepted
**Date:** 2026-02-25

## Context

The admin account (ADR-0003) requires server-side storage for artist mappings and album records (including cover art blobs). The storage solution must be:

- Durable across container rebuilds and redeploys
- Simple to operate with no external service dependency
- Sufficient for the scale: one user, hundreds of records at most, album art blobs of ~100–300 KB each

## Decision

Use **SQLite** stored at a configurable path (`SQLITE_PATH` env var, default `./data/config.db`). The `data/` directory is mounted as a **Fly.io persistent volume**, meaning the file survives container replacement.

Album art is stored as a `BLOB` column directly in SQLite. At personal-use scale this is well within SQLite's capabilities.

The path is kept outside the application source tree so deployment scripts never touch it.

## Consequences

### Positive
- Ships with Python — zero additional dependencies or services.
- A single file to back up; the entire config can be copied with `scp` or `fly ssh sftp`.
- No network round-trip for reads/writes — all config access is local I/O.
- Volume mount makes it genuinely persistent regardless of container lifecycle.

### Negative / Trade-offs
- Not suitable if the app ever scales to multiple backend instances (SQLite does not support concurrent writers across processes). This is not a concern for a single-instance personal tool.
- Storing BLOBs in SQLite is unconventional for large files; acceptable here because album art is small and the total number of records is low.
- Manual backup is required; the volume is not automatically replicated. A cron job or `fly ssh` copy is sufficient.

## Alternatives Considered

**Supabase** — hosted Postgres with auth and storage built in, free tier. Rejected as the primary solution because it introduces an external service dependency; if Supabase changes pricing or has an outage, the app's config access is affected. Remains a valid alternative if multi-device sync or true managed backups become priorities.

**Managed Postgres (Neon, Railway, Render)** — more robust than SQLite for concurrent access, but adds an external connection and credential management for no benefit at this scale.

**Filesystem (JSON files)** — simpler than SQLite but offers no query capability and is harder to update atomically. SQLite's transactional writes are worth the minor added complexity.
