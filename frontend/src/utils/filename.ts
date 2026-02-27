/**
 * Sanitize a string for use as a filename. Removes only characters not allowed
 * in filenames: \ / : * ? " < > |  Spaces and other characters are kept.
 * Result is trimmed, truncated to 100 chars, or "download" if empty.
 */
const DISALLOWED = new Set('\\/:*?"<>|');

export function safeFilename(name: string): string {
  const sanitized = name
    .split('')
    .filter((c) => !DISALLOWED.has(c))
    .join('')
    .trim();
  const truncated = sanitized.slice(0, 100);
  return truncated || 'download';
}
