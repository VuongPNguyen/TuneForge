# ADR-0003: Single admin account with server-side persistence; general users keep IndexedDB

**Status:** Accepted
**Date:** 2026-02-25

## Context

The primary user (site owner) needs their artist mappings and saved albums to survive browser data clearing, OS migration, and switching devices. IndexedDB alone cannot guarantee this — a stray "Clear browsing data" silently destroys everything with no recovery path.

Three options were evaluated:

1. **Export / import** — serialize IndexedDB contents to a JSON file that the user manually saves and restores.
2. **UUID token** — backend generates an opaque token stored in localStorage; config is synced to the server keyed to that token.
3. **Username / password** — a real login with credentials the user controls and stores intentionally.

## Decision

Implement a **single admin account** with username and password (credentials stored in `.env`). On login, the backend returns a JWT (30-day expiry) stored in localStorage. While authenticated:

- All reads and writes for artist mappings and albums go to the backend API instead of IndexedDB.
- On first load with a valid token, the frontend fetches the full config from the backend.

**General users** (not logged in) continue to use IndexedDB exactly as before — their experience is unchanged.

There is no registration flow, no email, no forgot-password. One account. The credentials are set by the person deploying the site.

## Consequences

### Positive
- Config stored on the server survives any browser-side data clearing.
- Cross-device: log in from any browser and the same mappings and albums are available.
- Zero friction for general users — they never see or need an account.
- No multi-user complexity (user table, registration, roles).

### Negative / Trade-offs
- Config durability depends on the backend storage being reliably backed up (addressed by ADR-0005).
- If the JWT token is cleared from localStorage (e.g. clearing all site data), the user must log in again — but the data on the server is unaffected.
- A single shared account means the admin credentials must be kept private; this is acceptable for a personal tool.

## Alternatives Considered

**Export / import** — rejected as the primary solution because it requires the user to remember to export *before* data is lost, which is exactly when people don't do it. Acceptable as a supplementary backup feature but not as the durability guarantee.

**UUID token** — rejected because it introduces a concept ("save this token somewhere safe") that is as easily lost as the data it was meant to protect. A username and password are universally understood and stored in password managers naturally.

**Full multi-user auth (Supabase Auth, etc.)** — rejected as over-engineered for a personal tool. The overhead of registration, email verification, and password reset flows is not justified.
