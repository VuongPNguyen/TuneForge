import { describe, it, expect } from 'vitest';
import {
  artistsForFilename,
  joinArtists,
  mapArtists,
  replaceArtist,
  splitArtists,
} from './artists';

describe('splitArtists / joinArtists', () => {
  it('splits on "/" and trims each artist', () => {
    expect(splitArtists('A / B/C')).toEqual(['A', 'B', 'C']);
  });

  it('drops empty segments', () => {
    expect(splitArtists('A//B/')).toEqual(['A', 'B']);
    expect(splitArtists('')).toEqual([]);
  });

  it('joins with "/"', () => {
    expect(joinArtists(['A', 'B'])).toBe('A/B');
  });
});

describe('mapArtists', () => {
  const table: Record<string, string> = {
    'chan a': 'Artist A',
    'chan b': 'Artist B',
    'AC/DC': 'AC⁄DC Official',
  };
  const lookup = (raw: string) => table[raw];

  it('maps a single artist', async () => {
    expect(await mapArtists('chan a', lookup)).toBe('Artist A');
  });

  it('maps each artist in a multi-artist value', async () => {
    expect(await mapArtists('chan a/unknown/chan b', lookup)).toBe('Artist A/unknown/Artist B');
  });

  it('prefers a mapping for the whole value', async () => {
    expect(await mapArtists('AC/DC', lookup)).toBe('AC⁄DC Official');
  });

  it('returns the value unchanged when nothing matches', async () => {
    expect(await mapArtists('nobody', lookup)).toBe('nobody');
  });

  it('supports async lookups', async () => {
    expect(await mapArtists('chan a/chan b', async (raw) => table[raw] ?? null)).toBe(
      'Artist A/Artist B',
    );
  });
});

describe('replaceArtist', () => {
  it('replaces the whole value', () => {
    expect(replaceArtist('A', 'A', 'X')).toBe('X');
  });

  it('replaces a single artist within a multi-artist value', () => {
    expect(replaceArtist('A/B/C', 'B', 'X')).toBe('A/X/C');
  });

  it('leaves non-matching values alone', () => {
    expect(replaceArtist('A/B', 'Z', 'X')).toBe('A/B');
    expect(replaceArtist('AB', 'A', 'X')).toBe('AB');
  });
});

describe('artistsForFilename', () => {
  it('lists multiple artists comma-separated', () => {
    expect(artistsForFilename('A/B')).toBe('A, B');
  });

  it('leaves a single artist unchanged', () => {
    expect(artistsForFilename('Artist')).toBe('Artist');
  });
});
