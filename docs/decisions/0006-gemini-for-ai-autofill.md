# ADR-0006: Use Google Gemini for AI Autofill

**Status:** Accepted
**Date:** 2026-02-26

## Context

Metadata returned by yt-dlp is sourced from YouTube video titles and channel names, which are often noisy or incorrect:

- Titles include promotional suffixes like "(Official MV)", "[4K]", "M/V", etc.
- Artist names use the YouTube channel name rather than the official stage name.
- Album, track number, and genre fields are almost never populated.
- Non-English titles (e.g. Korean) may lack the official romanized or English title used on streaming platforms.

Users currently have to look up and type all of this manually. The goal was to add a one-click button that fetches accurate, streaming-platform-quality metadata for the current track.

## Decision

Use the **Google Gemini 2.0 Flash** model, called via the REST API (`generativelanguage.googleapis.com`), with **Google Search grounding** enabled.

- The backend exposes a new `POST /api/ai-autofill` endpoint that accepts the current tag state and the raw YouTube title, constructs a structured prompt, and returns cleaned tag suggestions.
- The prompt instructs Gemini to use **Apple Music** and **Spotify** as its primary reference sources, returning title, artist, album, album artist, year, track number, and genre in a JSON object.
- The feature is **opt-in and optional**: the endpoint returns HTTP 503 when `GEMINI_API_KEY` is not configured, and the UI labels the button as unavailable. The rest of the app is fully functional without it.
- A free API key is sufficient for personal use (no billing required at typical usage volumes).

## Consequences

### Positive
- Dramatically reduces manual metadata entry, especially for non-English music.
- Google Search grounding means the model can look up current release data rather than relying solely on training knowledge.
- Gemini 2.0 Flash is fast (typically under 5 seconds) and free-tier keys cover personal use comfortably.
- No API key → feature is silently absent; zero impact on users who don't configure it.

### Negative / Trade-offs
- Requires users to obtain and configure a third-party API key.
- Suggestions can be wrong or hallucinated, especially for obscure tracks; users must still review before saving.
- Adds an external network call on the backend (latency, potential outage dependency).
- The free tier has rate limits (10 requests/minute matches the backend's own rate limit for this endpoint).

## Alternatives Considered

**MusicBrainz API** — free, no key required, open data. Rejected because fuzzy title matching is unreliable for non-English and K-pop titles, and it has no grounded search to handle YouTube-style noisy titles.

**Spotify Web API** — accurate data but requires OAuth client credentials and a more complex setup. Rejected to keep the configuration surface small.

**Apple Music API** — requires an Apple Developer account and a signed JWT. Rejected for the same reason.

**OpenAI GPT-4o** — comparable quality but costs money per call and has no built-in search grounding. Rejected in favour of the Gemini free tier.

**Client-side model (WebLLM / Transformers.js)** — no server key needed, fully offline. Rejected because models small enough to run in-browser lack the music knowledge breadth needed for reliable metadata lookup.
