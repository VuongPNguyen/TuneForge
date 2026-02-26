# ADR-0001: Use IndexedDB over localStorage for client-side persistence

**Status:** Accepted
**Date:** 2026-02-25

## Context

Users need a way to persist two types of data in the browser:

1. **Artist name mappings** — channel name → preferred display name (e.g. "tripleS official" → "tripleS"), applied automatically when a download's artist field matches.
2. **Album records** — album artist + album title keyed to genre, year, and cover art, used to autofill those fields on future downloads of the same album.

The question was whether to use `localStorage` or `IndexedDB`.

## Decision

Use **IndexedDB** via the [`idb`](https://github.com/jakearchibald/idb) wrapper library.

Two object stores:
- `artist-mappings` — keyed by `raw` (the exact channel name)
- `albums` — keyed by `${album_artist}|||${album}`

## Consequences

### Positive
- No meaningful storage quota — IndexedDB is governed by available disk space (typically hundreds of MB), far beyond the ~5 MB hard cap of localStorage.
- Binary data (`Blob`) is stored natively without base64 encoding overhead, which matters for album art thumbnails.
- Stays entirely client-side — no backend required for general users; zero infrastructure cost.
- Works automatically with no user action.

### Negative / Trade-offs
- Data is browser-local: clearing site data or using incognito wipes everything.
- Not portable across devices by default.
- Slightly more complex API than localStorage (mitigated by `idb`).

## Alternatives Considered

**localStorage** — rejected because album art stored as base64 strings would exhaust the ~5 MB quota after roughly 15–50 albums depending on image size.

**Backend database for all users** — rejected at this stage because there are no user accounts; assigning server-side storage to anonymous visitors would require inventing an identity system for no user-facing benefit.
