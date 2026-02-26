# Architecture Decision Records

This directory contains ADRs (Architecture Decision Records) documenting significant technical choices made during development. Each record captures the context, the decision, its consequences, and the alternatives that were considered and rejected.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](./0001-indexeddb-over-localstorage.md) | Use IndexedDB over localStorage for client-side persistence | Accepted |
| [0002](./0002-settings-in-music-tab.md) | Co-locate artist and album settings inside the Music tab | Accepted |
| [0003](./0003-single-admin-account-model.md) | Single admin account with server-side persistence; general users keep IndexedDB | Accepted |
| [0004](./0004-sqlite-on-persistent-volume.md) | SQLite on a persistent volume for admin config storage | Accepted |
| [0005](./0005-fly-io-deployment.md) | Deploy on Fly.io as a single container | Accepted |
| [0006](./0006-gemini-for-ai-autofill.md) | Use Google Gemini for AI Autofill | Accepted |

## Format

Each ADR follows this structure:

- **Status** — `Proposed`, `Accepted`, `Deprecated`, or `Superseded by ADR-XXXX`
- **Context** — the situation and forces that prompted a decision
- **Decision** — what was decided and the key details
- **Consequences** — positive outcomes and trade-offs
- **Alternatives Considered** — what else was evaluated and why it was rejected
