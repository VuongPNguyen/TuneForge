# Self-hosting walkthrough

Follow these steps in order on the machine you want to run TuneForge on (your PC, NAS, or server).

**Devcontainer or host?**  
- **Testing the walkthrough** — Running inside the devcontainer (e.g. in Cursor) is fine. The app and tunnel will work until you stop the container or close the IDE.  
- **Real self-hosting (always on, from the internet)** — Run on your **host machine** (or a server), not inside the devcontainer. Otherwise the app goes down whenever the devcontainer stops.

---

## Running outside the devcontainer (on your host)

1. **Open a terminal on your real machine** — e.g. Windows Terminal, Terminal.app, or a Linux terminal. Not the integrated terminal in Cursor if that’s attached to the devcontainer.
2. **Get the project on the host** — If you only have the repo inside the devcontainer, clone it on the host (e.g. to `~/YoutubeToMP3` or `C:\Users\You\YoutubeToMP3`), or copy the project folder out. All steps below run from this folder on the host.
3. **Install what you need on the host** — Docker, or Python 3.12+, Node 18+, and FFmpeg. The devcontainer doesn’t provide these to your host.
4. **Follow the steps below** — Same commands; just run them in that host terminal, in the project directory on the host.

---

## Step 1: Get the code

If you haven’t already (on your host):

```bash
git clone https://github.com/YOUR_USER/YoutubeToMP3.git
cd YoutubeToMP3
```

(Replace with your repo URL, or use the path where the project already lives on your machine.)

---

## Step 2: Choose how to run it

**Option A — Docker (simplest)**  
If you have Docker installed:

```bash
docker build -t tuneforge .
```

Then go to **Step 3 (Docker)**.

**Option B — Python + Node (no Docker)**  
You need: **Python 3.12+**, **Node 18+**, **FFmpeg**.  
Install them with your package manager if needed (e.g. `apt`, `brew`, `winget`).

Then:

```bash
# 2a. Backend: create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# 2b. Frontend: install and build
cd frontend
npm ci
npm run build
cd ..
```

Then go to **Step 3 (No Docker)**.

---

## Step 3: Set your admin login and secret

You need three values. **Pick your own username and password**; the secret must be a long random string.

**Generate a secret (run once, copy the output):**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Example output: `982e5e4b7959f1edeec5150abffe21e0253ffc7d0dbf32d686bc7d6ff3b89b65`

**Set these in your environment** (replace with your real values):

- `ADMIN_USERNAME` — e.g. `yourname`
- `ADMIN_PASSWORD` — e.g. a strong password you’ll remember
- `JWT_SECRET` — paste the long hex string from the command above

---

## Step 4: Start the app

**If you’re using Docker (Step 3 A):**

```bash
docker run -d \
  --name tuneforge \
  -p 8000:8000 \
  -e ADMIN_USERNAME=yourname \
  -e ADMIN_PASSWORD=yourpassword \
  -e JWT_SECRET=PasteYourGeneratedSecretHere \
  tuneforge
```

Replace `yourname`, `yourpassword`, and `PasteYourGeneratedSecretHere` with your values.

**If you’re not using Docker (Step 3 B):**

```bash
# From the project root, with .venv activated
export ADMIN_USERNAME=yourname
export ADMIN_PASSWORD=yourpassword
export JWT_SECRET=PasteYourGeneratedSecretHere
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Again, replace with your real values. Leave this terminal open; the app runs in the foreground.

---

## Step 5: Check it works locally

Open a browser on the same machine and go to:

**http://localhost:8000**

You should see TuneForge. Log in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you set.  
If that works, the app is running. Next is making it reachable from the internet.

---

## Step 6: Put it on the internet (tunnel — easiest)

This gives you a public HTTPS URL without touching your router.

1. **Install Cloudflare’s tunnel client (cloudflared)**  
   - Linux: [Install cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)  
   - macOS: `brew install cloudflared`  
   - Windows: download from the link above or `winget install cloudflare.cloudflared`

2. **Start a quick tunnel** (with the app already running on port 8000):

   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```

3. **Copy the URL**  
   The command prints a line like:

   ```text
   Your quick Tunnel has been created! Visit it at:
   https://random-words-here.trycloudflare.com
   ```

   Open that URL in any browser (even on your phone or another network). You should see TuneForge over HTTPS.

4. **Keep it running**  
   As long as this terminal is open and the tunnel command is running, that URL will work. To have it run in the background or after reboot, you can set up a [named Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) with your own domain.

---

## Step 7: Optional — persistent data (Docker)

If you used Docker and want artist mappings and saved albums to survive container restarts, use a volume and restart the container:

```bash
docker stop tuneforge
docker rm tuneforge

docker run -d \
  --name tuneforge \
  -p 8000:8000 \
  -v tuneforge_data:/app/data \
  -e ADMIN_USERNAME=yourname \
  -e ADMIN_PASSWORD=yourpassword \
  -e JWT_SECRET=YourSecretHere \
  tuneforge
```

Then start the tunnel again (Step 6) if you want the public URL.

---

## Quick reference

| Step | What you do |
|------|-----------------------------|
| 1 | Get the code, `cd` into project |
| 2 | Docker: `docker build -t tuneforge .` **or** Python+Node: venv, `pip install`, `npm ci && npm run build` |
| 3 | Generate `JWT_SECRET`, choose `ADMIN_USERNAME` and `ADMIN_PASSWORD` |
| 4 | Start app: `docker run ...` or `uvicorn backend.main:app --host 0.0.0.0 --port 8000` |
| 5 | Open http://localhost:8000 and log in |
| 6 | Run `cloudflared tunnel --url http://localhost:8000` and use the printed HTTPS URL |

If anything fails, check the main [Self-hosting guide](SELF-HOST.md) for more detail and troubleshooting.
