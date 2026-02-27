# Deploying to Fly.io

Step-by-step reference for deploying TuneForge to [Fly.io](https://fly.io). For the rationale behind Fly.io, see [ADR-0005: Deploy on Fly.io](decisions/0005-fly-io-deployment.md).

---

## Prerequisites

- [flyctl](https://fly.io/docs/flyctl/install/) installed and authenticated (`fly auth login`)
- Docker running locally (used by flyctl to build the image)
- A Fly.io account (free tier is sufficient)

---

## First-time setup

### 1. Create the app

```bash
fly launch --no-deploy
```

This registers the app name and writes `fly.toml`. If the app name `tuneforge` is taken,
flyctl will suggest an alternative — update the `app` field in `fly.toml` accordingly.

### 2. Create the persistent volume

The admin config (artist mappings and saved albums) is stored on a 1 GB volume mounted
at `/app/data`. Create it **once**, in the same region as the app (`iad` by default):

```bash
fly volumes create tuneforge_data --region iad --size 1
```

> If you changed the region in `fly.toml`, replace `iad` with your region code.
> The volume name must match the `source` field in the `[[mounts]]` section of `fly.toml`.

### 3. Set secrets

All sensitive values are injected as Fly secrets — they are never stored in the image or
committed to the repo.

```bash
# Admin account credentials (required for the admin login to work)
fly secrets set \
  ADMIN_USERNAME=yourname \
  ADMIN_PASSWORD=yourpassword \
  JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")

# Optional: AI Autofill via Google Gemini
fly secrets set GEMINI_API_KEY=AIza...
```

> You can run these as one command or separately. `JWT_SECRET` must be a long random
> string — the one-liner above generates a secure 32-byte hex value.

### 4. Deploy

```bash
fly deploy
```

flyctl builds the Docker image locally, pushes it to Fly's registry, and starts the
machine. The health check at `/api/health` must pass before the deploy is considered
successful.

---

## Pre-deploy checklist

From the repo root, run (requires `fly` in your PATH):

```bash
./scripts/fly-preflight.sh
```

Or verify manually:

| Check | Command | What you need |
|-------|---------|----------------|
| App exists | `fly status` | App name and "No machines" or machine list |
| Volume exists | `fly volumes list` | `ytmp3_data` in region `iad` |
| Secrets set | `fly secrets list` | `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET` (and optionally `GEMINI_API_KEY`) |

If any check fails, fix it before running `fly deploy`.

---

## Subsequent deploys

```bash
fly deploy
```

That's it. Secrets and the persistent volume are preserved across deploys.

---

## Optional: Deploy from GitHub Actions

The repo includes a workflow that deploys to Fly.io on every push to `main`. To use it:

1. In the [Fly.io dashboard](https://fly.io/dashboard), open your app → **Settings** → **Secrets** (or run `fly tokens create deploy` in the CLI) to create a **Deploy** token.
2. In GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Name it `FLY_API_TOKEN` and paste the token.

After that, pushing to `main` will trigger a deploy of TuneForge via `.github/workflows/fly-deploy.yml`. The workflow uses `--remote-only`, so the image is built on Fly's servers (no Docker required in CI).

---

## After first deploy

- Open the TuneForge app with `fly open` (or use the URL shown in `fly status`).
- Log in with your admin credentials (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
- Configure artist mappings and saved albums as needed; they are stored on the persistent volume and survive redeploys.

---

## Useful commands

| What | Command |
|---|---|
| View live logs | `fly logs` |
| Open the app in the browser | `fly open` |
| SSH into the running machine | `fly ssh console` |
| List secrets (names only, not values) | `fly secrets list` |
| Update a secret | `fly secrets set KEY=newvalue` |
| Remove a secret | `fly secrets unset KEY` |
| List volumes | `fly volumes list` |
| Check machine status | `fly status` |
| Scale memory / CPU | `fly scale memory 512` |
| Restart the app | `fly apps restart` |

---

## Checking the volume

To confirm admin config is being persisted on the volume:

```bash
fly ssh console
cat /app/data/admin_config.json
```

---

## Troubleshooting

**Deploy fails at health check**
- Run `fly logs` immediately after `fly deploy` to see startup errors.
- Make sure all three admin secrets (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`) are set — missing secrets don't cause a crash but the login endpoint will return 503.

**"volume not found" error**
- Confirm the volume name in `fly.toml` (`[[mounts]] source`) matches the name you used in `fly volumes create`.
- Volume and app must be in the same region.

**Admin login returns 503**
- At least one of `ADMIN_USERNAME`, `ADMIN_PASSWORD`, or `JWT_SECRET` is missing. Run `fly secrets list` to check which ones are set, then `fly secrets set` any that are missing.

**Admin config is lost after redeploy**
- Admin config is stored on the persistent volume, not in the image. As long as the volume exists and is correctly mounted, data survives redeploys. If you accidentally deleted the volume you will need to re-create it with `fly volumes create` and re-enter your settings after logging in.
