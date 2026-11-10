import type { ArtistMapping } from '../db';

export type SortDirection = 'asc' | 'desc';

export type MappingSortField = 'raw' | 'display' | 'date';

export interface MappingSort {
  by: MappingSortField;
  direction: SortDirection;
}

export const DEFAULT_MAPPING_SORT: MappingSort = { by: 'raw', direction: 'asc' };

export const MAPPING_SORT_FIELDS: { id: MappingSortField; label: string }[] = [
  { id: 'raw', label: 'Original name' },
  { id: 'display', label: 'Display name' },
  { id: 'date', label: 'Date added' },
];

export function flipDirection(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}

/** Human-readable meaning of a direction for the given field, e.g. for tooltips. */
export function directionLabel(by: MappingSortField | 'name', direction: SortDirection): string {
  if (by === 'date') return direction === 'asc' ? 'Oldest first' : 'Newest first';
  return direction === 'asc' ? 'A–Z' : 'Z–A';
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortMappings(mappings: ArtistMapping[], sort: MappingSort): ArtistMapping[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  return [...mappings].sort((a, b) => {
    if (sort.by === 'date') {
      const diff = (a.added_at ?? 0) - (b.added_at ?? 0);
      if (diff !== 0) return diff * dir;
      return compareText(a.raw, b.raw);
    }
    return compareText(a[sort.by], b[sort.by]) * dir || compareText(a.raw, b.raw);
  });
}

export function sortGenres(names: string[], direction: SortDirection): string[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...names].sort((a, b) => compareText(a, b) * dir);
}

// ── Search ──────────────────────────────────────────────────────────────────

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** Keep mappings whose original or display name contains the query. */
export function filterMappings(mappings: ArtistMapping[], query: string): ArtistMapping[] {
  const q = normalizeQuery(query);
  if (!q) return mappings;
  return mappings.filter(
    (m) => m.raw.toLocaleLowerCase().includes(q) || m.display.toLocaleLowerCase().includes(q)
  );
}

export function filterGenres(names: string[], query: string): string[] {
  const q = normalizeQuery(query);
  if (!q) return names;
  return names.filter((n) => n.toLocaleLowerCase().includes(q));
}

// ── Persistence ─────────────────────────────────────────────────────────────

const GENRE_SORT_KEY = 'genre_sort';

export function loadGenreSort(): SortDirection {
  try {
    return localStorage.getItem(GENRE_SORT_KEY) === 'desc' ? 'desc' : 'asc';
  } catch {
    return 'asc';
  }
}

export function saveGenreSort(direction: SortDirection): void {
  try {
    localStorage.setItem(GENRE_SORT_KEY, direction);
  } catch {
    // Storage may be unavailable (e.g. privacy mode); the sort still applies for now.
  }
}

const MAPPING_SORT_KEY = 'mapping_sort';

/** Stored as `<field>-<direction>`, e.g. `display-desc`. */
export function loadMappingSort(): MappingSort {
  try {
    const [by, direction] = (localStorage.getItem(MAPPING_SORT_KEY) ?? '').split('-');
    if (MAPPING_SORT_FIELDS.some((f) => f.id === by) && (direction === 'asc' || direction === 'desc')) {
      return { by: by as MappingSortField, direction };
    }
    return DEFAULT_MAPPING_SORT;
  } catch {
    return DEFAULT_MAPPING_SORT;
  }
}

export function saveMappingSort(sort: MappingSort): void {
  try {
    localStorage.setItem(MAPPING_SORT_KEY, `${sort.by}-${sort.direction}`);
  } catch {
    // Storage may be unavailable (e.g. privacy mode); the sort still applies for now.
  }
}
