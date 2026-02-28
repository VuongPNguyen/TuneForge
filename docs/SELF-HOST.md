# Self-hosting on your own machine (with internet access)

---

## Simple overview

**What you're doing:** Run the TuneForge website on your computer, then give it a public address so you (or others) can open it from anywhere.

**In three steps:**

1. **Run the app**  
   You start TuneForge in a container (Docker) or with Python. It’s now a website that only your computer knows about — you open it at `http://localhost:8000`.

2. **Create a login**  
   You choose an admin username and password (and a secret key the app needs). Those are set when you start the app so only you can use the admin features.

3. **Put it on the internet**  
   Right now the site only works on your machine. To reach it from the internet you use one of two approaches:
   - **Tunnel (easiest):** A small program (e.g. Cloudflare Tunnel) runs on your computer and creates a secure link to the internet. You get a URL like `https://something.trycloudflare.com`. No router settings, no opening ports — the link goes *out* from your PC to the tunnel provider, then they give you a public URL.
   - **Port forwarding:** You tell your router “when someone hits my home on port 443, send them to this computer.” Then you run a small web server (e.g. Caddy) on that computer that does HTTPS and forwards requests to TuneForge. This uses your own domain and requires a bit more setup.

**Summary:** Run the app → set your password and secret → use a tunnel or port forwarding so the world can reach it. The detailed steps below are the same process with exact commands.

For a single **step-by-step walkthrough** you can follow from start to finish, see **[Self-hosting walkthrough](SELF-HOST-WALKTHROUGH.md)**.

---

## 1. Prerequisites on your machine

- **Docker** (recommended), or:
  - **Python 3.12+**, **Node 18+**, **FFmpeg**, and **yt-dlp**
- If you expose the app to the internet, use **HTTPS** (see step 3). Plain HTTP is only for local testing.

---

## 2. Run the app

### Option A: Docker (recommended)

From the repo root:

```bash
# Build and run (frontend is built inside the image)
docker build -t tuneforge .
docker run -d \
  --name tuneforge \
  -p 8000:8000 \
  -e ADMIN_USERNAME=yourname \
  -e ADMIN_PASSWORD=yourpassword \
  -e JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')" \
  tuneforge
```

Optional: AI Autofill and persistent data directory:

```bash
docker run -d \
  --name tuneforge \
  -p 8000:8000 \
  -v tuneforge_data:/app/data \
  -e ADMIN_USERNAME=yourname \
  -e ADMIN_PASSWORD=yourpassword \
  -e JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')" \
  -e GEMINI_API_KEY=your_gemini_key_if_you_want_autofill \
  tuneforge
```

- Replace `yourname` / `yourpassword` with your admin login.
- `JWT_SECRET` must be a long random string; the one-liner above generates one.
- Open **http://localhost:8000** (or **http://YOUR_MACHINE_IP:8000** on your LAN).

### Option B: Without Docker

1. **Install**: Python 3.12+, Node 18+, FFmpeg, yt-dlp (e.g. `pip install yt-dlp`, or your OS package manager).
2. **Backend deps**: `cd backend && pip install -r requirements.txt`
3. **Build frontend**: `cd frontend && npm ci && npm run build`
4. **Run** (from repo root, so `backend/` and `frontend/dist/` exist):

   ```bash
   export ADMIN_USERNAME=yourname
   export ADMIN_PASSWORD=yourpassword
   export JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```

5. Open **http://localhost:8000**.

---

## 3. Expose it to the internet

Your app is only listening on your machine. To reach it from the internet you have two main options.

### Option A: Cloudflare Tunnel (no port forwarding, free HTTPS)

Good if you don’t want to open ports on your router or deal with dynamic IPs.

1. Create a free [Cloudflare](https://cloudflare.com) account and add your domain (or use a subdomain Cloudflare gives you via TryCloudflare).
2. Install **cloudflared**: [Install cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
3. Run a quick tunnel to your app:

   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```

   Cloudflare will print a temporary URL like `https://something.trycloudflare.com`. Use that to access TuneForge over HTTPS from anywhere.

4. For a **custom domain** and a permanent tunnel, use a named tunnel and DNS in the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/) (Tunnels → Create a tunnel → Configure with your hostname and `http://localhost:8000`).

No port forwarding or static IP needed; traffic goes out from your machine to Cloudflare.

### Option B: Port forwarding + reverse proxy (your router, your IP)

1. **Static or dynamic DNS**: If your home IP changes, use a free Dynamic DNS service (e.g. No-IP, Duck DNS) so you have a hostname that always points to your IP.
2. **Port forwarding**: On your router, forward **443** (HTTPS) to your machine’s LAN IP (e.g. `192.168.1.100`).
3. **Reverse proxy + HTTPS**: On your machine, run a reverse proxy (e.g. **Caddy** or **nginx**) that:
   - Listens on 443 with HTTPS (use [Let’s Encrypt](https://letsencrypt.org/) for a free certificate).
   - Proxies to `http://localhost:8000` for TuneForge.

Example with **Caddy** (auto HTTPS with Let’s Encrypt):

```bash
# Install Caddy, then create Caddyfile:
# yourdomain.com {
#   reverse_proxy localhost:8000
# }
caddy run
```

Replace `yourdomain.com` with your real hostname. Caddy will obtain and renew the certificate automatically.

---

## 4. Security checklist

| Item | Notes |
|------|--------|
| **Admin credentials** | Set strong `ADMIN_USERNAME` and `ADMIN_PASSWORD`; never leave default or empty. |
| **JWT_SECRET** | Must be set and random (e.g. `secrets.token_hex(32)`). |
| **HTTPS** | Use HTTPS when the site is reachable from the internet (Cloudflare Tunnel or reverse proxy). |
| **Firewall** | If you use port forwarding, only expose 443 (or 80 for Caddy) and block 8000 from the internet; let only the reverse proxy talk to 8000 locally. |

---

## 5. Optional environment variables

| Variable | Purpose |
|----------|---------|
| `ADMIN_USERNAME` | Admin login (required for login to work). |
| `ADMIN_PASSWORD` | Admin password (required). |
| `JWT_SECRET` | Secret for JWT signing (required). |
| `GEMINI_API_KEY` | Enables AI Autofill for metadata (optional). |
| `SQLITE_PATH` | Path for SQLite DB (default: `data/config.db`). |
| `CORS_ORIGINS` | Comma-separated origins if the frontend is served from another domain. |

---

## Quick reference

- **Local only**: Run with Docker or uvicorn, open `http://localhost:8000`.
- **LAN**: Run with `--host 0.0.0.0`, open `http://YOUR_LAN_IP:8000`.
- **Internet (easiest)**: Use Cloudflare Tunnel and the generated `https://…` URL.
- **Internet (custom domain)**: Port forward 443 → reverse proxy (Caddy/nginx) → `localhost:8000`, or use a named Cloudflare Tunnel with your domain.
