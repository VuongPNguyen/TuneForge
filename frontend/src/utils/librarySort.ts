import type { ArtistMapping } from '../db';

export type SortDirection = 'asc' | 'desc';

export interface MappingSort {
  by: 'name' | 'date';
  /** Which name to sort by when `by` is 'name'. */
  nameField: 'raw' | 'display';
  direction: SortDirection;
}

export const DEFAULT_MAPPING_SORT: MappingSort = { by: 'name', nameField: 'raw', direction: 'asc' };

export const MAPPING_SORT_OPTIONS: { id: string; label: string; sort: MappingSort }[] = [
  { id: 'raw-asc', label: 'Original name (A–Z)', sort: { by: 'name', nameField: 'raw', direction: 'asc' } },
  { id: 'raw-desc', label: 'Original name (Z–A)', sort: { by: 'name', nameField: 'raw', direction: 'desc' } },
  { id: 'display-asc', label: 'Display name (A–Z)', sort: { by: 'name', nameField: 'display', direction: 'asc' } },
  { id: 'display-desc', label: 'Display name (Z–A)', sort: { by: 'name', nameField: 'display', direction: 'desc' } },
  { id: 'date-desc', label: 'Newest first', sort: { by: 'date', nameField: 'raw', direction: 'desc' } },
  { id: 'date-asc', label: 'Oldest first', sort: { by: 'date', nameField: 'raw', direction: 'asc' } },
];

export function mappingSortId(sort: MappingSort): string {
  return sort.by === 'date' ? `date-${sort.direction}` : `${sort.nameField}-${sort.direction}`;
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
    return compareText(a[sort.nameField], b[sort.nameField]) * dir || compareText(a.raw, b.raw);
  });
}

// ── Persistence ─────────────────────────────────────────────────────────────

const MAPPING_SORT_KEY = 'mapping_sort';

export function loadMappingSort(): MappingSort {
  try {
    const id = localStorage.getItem(MAPPING_SORT_KEY);
    return MAPPING_SORT_OPTIONS.find((o) => o.id === id)?.sort ?? DEFAULT_MAPPING_SORT;
  } catch {
    return DEFAULT_MAPPING_SORT;
  }
}

export function saveMappingSort(sort: MappingSort): void {
  try {
    localStorage.setItem(MAPPING_SORT_KEY, mappingSortId(sort));
  } catch {
    // Storage may be unavailable (e.g. privacy mode); the sort still applies for now.
  }
}
