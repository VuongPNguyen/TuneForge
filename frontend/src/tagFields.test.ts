import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_TAG_LAYOUT, normalizeTagLayout, moveTagField, toggleTagField,
  visibleTagFields, loadSessionTagLayout, saveSessionTagLayout,
} from './tagFields';

describe('normalizeTagLayout', () => {
  it('falls back to the default layout for junk input', () => {
    expect(normalizeTagLayout(null)).toEqual(DEFAULT_TAG_LAYOUT);
    expect(normalizeTagLayout('nope')).toEqual(DEFAULT_TAG_LAYOUT);
  });

  it('drops unknown and duplicate keys and appends missing fields', () => {
    const layout = normalizeTagLayout({
      order: ['genre', 'bogus', 'genre', 'title'],
      enabled: ['composer', 'title', 'bogus', 'composer'],
    });
    expect(layout.order.slice(0, 2)).toEqual(['genre', 'title']);
    expect(new Set(layout.order)).toEqual(new Set(DEFAULT_TAG_LAYOUT.order));
    expect(layout.order).toHaveLength(DEFAULT_TAG_LAYOUT.order.length);
    expect(layout.enabled).toEqual(['composer']);
  });
});

describe('layout helpers', () => {
  it('moves a field to a new index', () => {
    const next = moveTagField(DEFAULT_TAG_LAYOUT, 'genre', 0);
    expect(next.order[0]).toBe('genre');
    expect(next.order[1]).toBe('title');
  });

  it('clamps out-of-range moves', () => {
    expect(moveTagField(DEFAULT_TAG_LAYOUT, 'title', -1)).toBe(DEFAULT_TAG_LAYOUT);
  });

  it('toggles additional fields on and off', () => {
    const on = toggleTagField(DEFAULT_TAG_LAYOUT, 'disc_number');
    expect(on.enabled).toEqual(['disc_number']);
    expect(toggleTagField(on, 'disc_number').enabled).toEqual([]);
  });

  it('only lists default fields plus enabled extras as visible', () => {
    const keys = visibleTagFields(toggleTagField(DEFAULT_TAG_LAYOUT, 'composer')).map((f) => f.key);
    expect(keys).toEqual([
      'title', 'artist', 'album', 'album_artist', 'year', 'track_number', 'genre', 'composer',
    ]);
  });
});

describe('session persistence', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a layout through sessionStorage', () => {
    const layout = toggleTagField(moveTagField(DEFAULT_TAG_LAYOUT, 'year', 0), 'bpm');
    saveSessionTagLayout(layout);
    expect(loadSessionTagLayout()).toEqual(layout);
  });

  it('returns the default layout when nothing is stored', () => {
    expect(loadSessionTagLayout()).toEqual(DEFAULT_TAG_LAYOUT);
  });
});
