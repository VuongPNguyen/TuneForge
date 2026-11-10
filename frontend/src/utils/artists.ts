/**
 * Multiple artists are stored in a single tag delimited by "/" (the ID3v2.3
 * multi-value separator), e.g. "Artist A/Artist B".
 */
export const ARTIST_DELIMITER = '/';

export function splitArtists(value: string): string[] {
  return value
    .split(ARTIST_DELIMITER)
    .map((a) => a.trim())
    .filter(Boolean);
}

export function joinArtists(artists: string[]): string {
  return artists.join(ARTIST_DELIMITER);
}

/**
 * Apply a raw→display artist lookup to a possibly multi-artist value.
 * The whole value is tried first so mappings saved for the full string
 * (or names containing "/", like "AC/DC") keep working; otherwise each
 * artist is mapped individually.
 */
export async function mapArtists(
  value: string,
  lookup: (raw: string) => string | null | undefined | Promise<string | null | undefined>,
): Promise<string> {
  const whole = await lookup(value);
  if (whole) return whole;
  const parts = splitArtists(value);
  if (parts.length < 2) return value;
  const mapped = await Promise.all(parts.map(async (p) => (await lookup(p)) || p));
  return joinArtists(mapped);
}

/** Replace `raw` with `display` in a value, either as the whole value or as one of its artists. */
export function replaceArtist(value: string, raw: string, display: string): string {
  if (value === raw) return display;
  const parts = splitArtists(value);
  if (parts.length < 2 || !parts.includes(raw)) return value;
  return joinArtists(parts.map((p) => (p === raw ? display : p)));
}

/** "/" is not allowed in filenames, so list multiple artists comma-separated instead. */
export function artistsForFilename(value: string): string {
  return splitArtists(value).join(', ');
}
