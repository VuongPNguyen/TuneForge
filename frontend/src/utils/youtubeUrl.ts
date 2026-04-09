/** YouTube video IDs are 11 characters (alphanumeric, underscore, hyphen). */
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_HOSTNAMES = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * Returns a canonical `https://www.youtube.com/watch?v=...` URL with only the
 * video id, or `null` if the URL is not a recognizable single-video link.
 */
export function normalizeYoutubeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return null;
  }
  if (!ALLOWED_HOSTNAMES.has(u.hostname)) {
    return null;
  }
  if (u.hostname === 'youtu.be') {
    const segment = u.pathname.replace(/^\//, '').split('/')[0] ?? '';
    if (YOUTUBE_VIDEO_ID_RE.test(segment)) {
      return `https://www.youtube.com/watch?v=${segment}`;
    }
    return null;
  }
  const v = u.searchParams.get('v');
  if (v && YOUTUBE_VIDEO_ID_RE.test(v.trim())) {
    return `https://www.youtube.com/watch?v=${v.trim()}`;
  }
  const parts = u.pathname.split('/').filter(Boolean);
  if (
    parts.length >= 2 &&
    ['shorts', 'embed', 'v', 'live'].includes(parts[0]) &&
    YOUTUBE_VIDEO_ID_RE.test(parts[1])
  ) {
    return `https://www.youtube.com/watch?v=${parts[1]}`;
  }
  return null;
}
