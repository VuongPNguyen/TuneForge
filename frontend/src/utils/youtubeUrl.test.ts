import { describe, it, expect } from 'vitest';
import { normalizeYoutubeUrl } from './youtubeUrl';

describe('normalizeYoutubeUrl', () => {
  it('strips extra query params from watch URLs', () => {
    expect(
      normalizeYoutubeUrl(
        'https://www.youtube.com/watch?v=kPa7bsKwL-c&list=PLuxt6DrBFfRO8pp7PgjgZ7Tqt3pFB9_Kv&index=19',
      ),
    ).toBe('https://www.youtube.com/watch?v=kPa7bsKwL-c');
  });

  it('normalizes youtu.be to www watch URL', () => {
    expect(normalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  it('returns null when no video id can be extracted', () => {
    expect(normalizeYoutubeUrl('https://www.youtube.com/playlist?list=PLxxx')).toBeNull();
  });
});
