import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAPPING_SORT, MAPPING_SORT_OPTIONS, loadMappingSort, saveMappingSort, sortMappings,
  loadGenreSort, saveGenreSort, sortGenres,
} from './librarySort';

const MAPPINGS = [
  { raw: 'beta', display: 'Zed', added_at: 200 },
  { raw: 'Alpha', display: 'yak', added_at: 300 },
  { raw: 'gamma', display: 'Xi' },
];

function sortBy(id: string) {
  const option = MAPPING_SORT_OPTIONS.find((o) => o.id === id)!;
  return sortMappings(MAPPINGS, option.sort).map((m) => m.raw);
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

describe('mapping sort persistence', () => {
  it('defaults when nothing or junk is stored', () => {
    expect(loadMappingSort()).toEqual(DEFAULT_MAPPING_SORT);
    localStorage.setItem('mapping_sort', 'nonsense');
    expect(loadMappingSort()).toEqual(DEFAULT_MAPPING_SORT);
  });

  it('round-trips a saved sort', () => {
    const newest = MAPPING_SORT_OPTIONS.find((o) => o.id === 'date-desc')!.sort;
    saveMappingSort(newest);
    expect(loadMappingSort()).toEqual(newest);
  });
});
