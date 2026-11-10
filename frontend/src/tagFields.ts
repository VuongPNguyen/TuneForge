import {
  Music, User, Disc, Users, Calendar, Hash, Tag,
  PenLine, Disc3, Layers, Feather, AudioLines, Shuffle, Gauge,
  Building2, Copyright, FolderOpen, Type, Barcode, FileText,
  type LucideIcon,
} from 'lucide-react';
import type { ID3Tags } from './types';

export type DefaultTagKey =
  | 'title' | 'artist' | 'album' | 'album_artist' | 'year' | 'track_number' | 'genre';

export type ExtraTagKey =
  | 'composer' | 'disc_number' | 'compilation' | 'lyricist' | 'conductor' | 'remixer'
  | 'bpm' | 'publisher' | 'copyright' | 'grouping' | 'subtitle' | 'isrc' | 'lyrics';

export type TagFieldKey = DefaultTagKey | ExtraTagKey;

export interface TagFieldDef {
  key: TagFieldKey;
  label: string;
  placeholder: string;
  icon: LucideIcon;
  kind: 'text' | 'toggle' | 'textarea';
  maxLength?: number;
  /** Spans both columns of the tag grid. */
  wide?: boolean;
  /** Short explanation shown in the Additional tags popup. */
  description?: string;
}

export const DEFAULT_TAG_FIELDS: TagFieldDef[] = [
  { key: 'title', label: 'Title', placeholder: 'Track title', icon: Music, kind: 'text', wide: true },
  { key: 'artist', label: 'Artist', placeholder: 'Artist name', icon: User, kind: 'text' },
  { key: 'album', label: 'Album', placeholder: 'Album name', icon: Disc, kind: 'text' },
  { key: 'album_artist', label: 'Album Artist', placeholder: 'Album artist name', icon: Users, kind: 'text' },
  { key: 'year', label: 'Year', placeholder: 'e.g. 2024', icon: Calendar, kind: 'text', maxLength: 4 },
  { key: 'track_number', label: 'Track Number', placeholder: 'e.g. 1 or 1/12', icon: Hash, kind: 'text' },
  { key: 'genre', label: 'Genre', placeholder: 'e.g. Electronic', icon: Tag, kind: 'text', maxLength: 100 },
];

export const EXTRA_TAG_FIELDS: TagFieldDef[] = [
  { key: 'composer', label: 'Composer', placeholder: 'Composer name', icon: PenLine, kind: 'text', maxLength: 500 },
  { key: 'disc_number', label: 'Disc Number', placeholder: 'e.g. 1 or 1/2', icon: Disc3, kind: 'text', maxLength: 20 },
  {
    key: 'compilation', label: 'Compilation', placeholder: '', icon: Layers, kind: 'toggle',
    description: 'Marks the track as part of a various-artists compilation',
  },
  { key: 'lyricist', label: 'Lyricist', placeholder: 'Lyricist name', icon: Feather, kind: 'text', maxLength: 500 },
  { key: 'conductor', label: 'Conductor', placeholder: 'Conductor name', icon: AudioLines, kind: 'text', maxLength: 500 },
  { key: 'remixer', label: 'Remixer', placeholder: 'Remixed by', icon: Shuffle, kind: 'text', maxLength: 500 },
  { key: 'bpm', label: 'BPM', placeholder: 'e.g. 120', icon: Gauge, kind: 'text', maxLength: 3 },
  { key: 'publisher', label: 'Publisher / Label', placeholder: 'Record label', icon: Building2, kind: 'text', maxLength: 500 },
  { key: 'copyright', label: 'Copyright', placeholder: 'e.g. © 2024 Label', icon: Copyright, kind: 'text', maxLength: 500 },
  { key: 'grouping', label: 'Grouping', placeholder: 'Content group', icon: FolderOpen, kind: 'text', maxLength: 500 },
  { key: 'subtitle', label: 'Subtitle', placeholder: 'e.g. Radio Edit', icon: Type, kind: 'text', maxLength: 500 },
  { key: 'isrc', label: 'ISRC', placeholder: 'e.g. USRC17607839', icon: Barcode, kind: 'text', maxLength: 15 },
  {
    key: 'lyrics', label: 'Lyrics', placeholder: 'Unsynchronised lyrics', icon: FileText, kind: 'textarea',
    maxLength: 20000, wide: true,
  },
];

export const TAG_FIELDS_BY_KEY: Record<TagFieldKey, TagFieldDef> = Object.fromEntries(
  [...DEFAULT_TAG_FIELDS, ...EXTRA_TAG_FIELDS].map((f) => [f.key, f])
) as Record<TagFieldKey, TagFieldDef>;

const DEFAULT_KEYS = new Set<string>(DEFAULT_TAG_FIELDS.map((f) => f.key));
const EXTRA_KEYS = new Set<string>(EXTRA_TAG_FIELDS.map((f) => f.key));

export function isDefaultTagKey(key: string): key is DefaultTagKey {
  return DEFAULT_KEYS.has(key);
}

export function isExtraTagKey(key: string): key is ExtraTagKey {
  return EXTRA_KEYS.has(key);
}

/** Empty values for every additional tag, used to seed the editor state. */
export const EMPTY_EXTRA_TAGS: Pick<ID3Tags, ExtraTagKey> = {
  composer: '', disc_number: '', compilation: false, lyricist: '', conductor: '', remixer: '',
  bpm: '', publisher: '', copyright: '', grouping: '', subtitle: '', isrc: '', lyrics: '',
};

// ── Layout ──────────────────────────────────────────────────────────────────

/**
 * Which tag fields appear in the editor and in what order. Default fields are
 * always shown; additional fields are shown only when listed in `enabled`.
 */
export interface TagFieldLayout {
  order: TagFieldKey[];
  enabled: ExtraTagKey[];
}

export const DEFAULT_TAG_LAYOUT: TagFieldLayout = {
  order: [...DEFAULT_TAG_FIELDS, ...EXTRA_TAG_FIELDS].map((f) => f.key),
  enabled: [],
};

/**
 * Coerce stored/received data into a valid layout: unknown keys are dropped,
 * duplicates removed and any missing fields appended in their default position
 * so newly added tag types still show up for existing saved layouts.
 */
export function normalizeTagLayout(raw: unknown): TagFieldLayout {
  if (!raw || typeof raw !== 'object') return DEFAULT_TAG_LAYOUT;
  const { order, enabled } = raw as { order?: unknown; enabled?: unknown };

  const seen = new Set<TagFieldKey>();
  const nextOrder: TagFieldKey[] = [];
  if (Array.isArray(order)) {
    for (const k of order) {
      if (typeof k === 'string' && k in TAG_FIELDS_BY_KEY && !seen.has(k as TagFieldKey)) {
        seen.add(k as TagFieldKey);
        nextOrder.push(k as TagFieldKey);
      }
    }
  }
  for (const k of DEFAULT_TAG_LAYOUT.order) {
    if (!seen.has(k)) nextOrder.push(k);
  }

  const nextEnabled = Array.isArray(enabled)
    ? [...new Set(enabled.filter((k): k is ExtraTagKey => typeof k === 'string' && isExtraTagKey(k)))]
    : [];

  return { order: nextOrder, enabled: nextEnabled };
}

export function isTagFieldVisible(layout: TagFieldLayout, key: TagFieldKey): boolean {
  return isDefaultTagKey(key) || layout.enabled.includes(key);
}

export function visibleTagFields(layout: TagFieldLayout): TagFieldDef[] {
  return layout.order.filter((k) => isTagFieldVisible(layout, k)).map((k) => TAG_FIELDS_BY_KEY[k]);
}

export function moveTagField(layout: TagFieldLayout, key: TagFieldKey, toIndex: number): TagFieldLayout {
  const from = layout.order.indexOf(key);
  if (from === -1) return layout;
  const to = Math.max(0, Math.min(toIndex, layout.order.length - 1));
  if (from === to) return layout;
  const order = [...layout.order];
  order.splice(from, 1);
  order.splice(to, 0, key);
  return { ...layout, order };
}

export function toggleTagField(layout: TagFieldLayout, key: ExtraTagKey): TagFieldLayout {
  const enabled = layout.enabled.includes(key)
    ? layout.enabled.filter((k) => k !== key)
    : [...layout.enabled, key];
  return { ...layout, enabled };
}

/** Blank out hidden additional tags so only what the user can see is written. */
export function stripHiddenExtraTags(tags: ID3Tags, layout: TagFieldLayout): ID3Tags {
  const next = { ...tags };
  for (const key of Object.keys(EMPTY_EXTRA_TAGS) as ExtraTagKey[]) {
    if (!layout.enabled.includes(key)) Object.assign(next, { [key]: EMPTY_EXTRA_TAGS[key] });
  }
  return next;
}

// ── Session persistence (guests) ────────────────────────────────────────────

const SESSION_LAYOUT_KEY = 'tag_field_layout';

export function loadSessionTagLayout(): TagFieldLayout {
  try {
    const raw = sessionStorage.getItem(SESSION_LAYOUT_KEY);
    return raw ? normalizeTagLayout(JSON.parse(raw)) : DEFAULT_TAG_LAYOUT;
  } catch {
    return DEFAULT_TAG_LAYOUT;
  }
}

export function saveSessionTagLayout(layout: TagFieldLayout): void {
  try {
    sessionStorage.setItem(SESSION_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Storage may be unavailable (e.g. privacy mode); the layout still applies in memory.
  }
}
