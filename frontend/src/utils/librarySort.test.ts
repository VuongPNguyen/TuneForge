import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAPPING_SORT, loadMappingSort, saveMappingSort, sortMappings,
  loadGenreSort, saveGenreSort, sortGenres, filterMappings, filterGenres,
  flipDirection, directionLabel,
  type MappingSortField, type SortDirection,
} from './librarySort';

const MAPPINGS = [
  { raw: 'beta', display: 'Zed', added_at: 200 },
  { raw: 'Alpha', display: 'yak', added_at: 300 },
  { raw: 'gamma', display: 'Xi' },
];

function sortBy(id: `${MappingSortField}-${SortDirection}`) {
  const [by, direction] = id.split('-') as [MappingSortField, SortDirection];
  return sortMappings(MAPPINGS, { by, direction }).map((m) => m.raw);
}

describe('sortMappings', () => {
  it('sorts by original name, case-insensitively', () => {
    expect(sortBy('raw-asc')).toEqual(['Alpha', 'beta', 'gamma']);
    expect(sortBy('raw-desc')).toEqual(['gamma', 'beta', 'Alpha']);
  });

  it('sorts by display name', () => {
    expect(sortBy('display-asc')).toEqual(['gamma', 'Alpha', 'beta']);
    expect(sortBy('display-desc')).toEqual(['beta', 'Alpha', 'gamma']);
  });

  it('sorts by date added, treating untracked entries as oldest', () => {
    expect(sortBy('date-desc')).toEqual(['Alpha', 'beta', 'gamma']);
    expect(sortBy('date-asc')).toEqual(['gamma', 'beta', 'Alpha']);
  });

  it('does not mutate the input', () => {
    const copy = [...MAPPINGS];
    sortBy('raw-desc');
    expect(MAPPINGS).toEqual(copy);
  });
});

describe('sortGenres', () => {
  it('sorts genres A–Z and Z–A, case-insensitively', () => {
    const genres = ['rock', 'Ambient', 'jazz'];
    expect(sortGenres(genres, 'asc')).toEqual(['Ambient', 'jazz', 'rock']);
    expect(sortGenres(genres, 'desc')).toEqual(['rock', 'jazz', 'Ambient']);
  });

  it('remembers the genre sort direction', () => {
    expect(loadGenreSort()).toBe('asc');
    saveGenreSort('desc');
    expect(loadGenreSort()).toBe('desc');
  });
});

describe('search', () => {
  it('matches mappings on original or display name, case-insensitively', () => {
    expect(filterMappings(MAPPINGS, 'ALP').map((m) => m.raw)).toEqual(['Alpha']);
    expect(filterMappings(MAPPINGS, 'xi').map((m) => m.raw)).toEqual(['gamma']);
    expect(filterMappings(MAPPINGS, '  ')).toBe(MAPPINGS);
    expect(filterMappings(MAPPINGS, 'nope')).toEqual([]);
  });

  it('matches genres by substring', () => {
    expect(filterGenres(['Synth-pop', 'K-Pop', 'Rock'], 'pop')).toEqual(['Synth-pop', 'K-Pop']);
  });
});

describe('mapping sort persistence', () => {
  it('defaults when nothing or junk is stored', () => {
    expect(loadMappingSort()).toEqual(DEFAULT_MAPPING_SORT);
    localStorage.setItem('mapping_sort', 'nonsense');
    expect(loadMappingSort()).toEqual(DEFAULT_MAPPING_SORT);
  });

  it('round-trips a saved sort', () => {
    saveMappingSort({ by: 'date', direction: 'desc' });
    expect(loadMappingSort()).toEqual({ by: 'date', direction: 'desc' });
  });

  it('reads values saved by the previous single-menu format', () => {
    localStorage.setItem('mapping_sort', 'display-desc');
    expect(loadMappingSort()).toEqual({ by: 'display', direction: 'desc' });
  });
});

describe('direction helpers', () => {
  it('flips direction', () => {
    expect(flipDirection('asc')).toBe('desc');
    expect(flipDirection('desc')).toBe('asc');
  });

  it('describes direction in terms of the field', () => {
    expect(directionLabel('raw', 'asc')).toBe('A–Z');
    expect(directionLabel('name', 'desc')).toBe('Z–A');
    expect(directionLabel('date', 'desc')).toBe('Newest first');
  });
});
