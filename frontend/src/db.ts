import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'yt-to-mp3';
const DB_VERSION = 2;

const GENRE_MAX_LEN = 100;

export interface ArtistMapping {
  raw: string;
  display: string;
}

export interface AlbumRecord {
  id: string;
  album_artist: string;
  album: string;
  genre: string;
  year: string;
  art: Blob | null;
}

let _db: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('artist-mappings', { keyPath: 'raw' });
          db.createObjectStore('albums', { keyPath: 'id' });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('genres')) {
          db.createObjectStore('genres', { keyPath: 'name' });
        }
      },
    });
  }
  return _db;
}

export function albumKey(albumArtist: string, album: string): string {
  return `${albumArtist}|||${album}`;
}

// --- Artist mappings ---

export async function getArtistMappings(): Promise<ArtistMapping[]> {
  const db = await getDb();
  return db.getAll('artist-mappings');
}

export async function putArtistMapping(mapping: ArtistMapping): Promise<void> {
  const db = await getDb();
  await db.put('artist-mappings', mapping);
}

export async function deleteArtistMapping(raw: string): Promise<void> {
  const db = await getDb();
  await db.delete('artist-mappings', raw);
}

export async function lookupArtist(raw: string): Promise<string | null> {
  if (!raw) return null;
  const db = await getDb();
  const record = await db.get('artist-mappings', raw);
  return record?.display ?? null;
}

// --- Albums ---

export async function getAlbums(): Promise<AlbumRecord[]> {
  const db = await getDb();
  return db.getAll('albums');
}

export async function putAlbum(record: AlbumRecord): Promise<void> {
  const db = await getDb();
  await db.put('albums', record);
}

export async function deleteAlbum(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('albums', id);
}

export async function lookupAlbum(albumArtist: string, album: string): Promise<AlbumRecord | null> {
  if (!albumArtist || !album) return null;
  const db = await getDb();
  return (await db.get('albums', albumKey(albumArtist, album))) ?? null;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- Saved genres (autocomplete vocabulary) ---

export interface GenreRecord {
  name: string;
}

export async function getGenreNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAll('genres');
  return rows
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Persist a genre after a successful download (deduped by trimmed name). */
export async function rememberGenre(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > GENRE_MAX_LEN) return;
  const db = await getDb();
  await db.put('genres', { name: trimmed });
}

export async function putGenreName(name: string): Promise<void> {
  await rememberGenre(name);
}

export async function deleteGenreName(name: string): Promise<void> {
  const db = await getDb();
  await db.delete('genres', name);
}

export async function renameGenreName(oldName: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > GENRE_MAX_LEN) return;
  const db = await getDb();
  const tx = db.transaction('genres', 'readwrite');
  await tx.store.delete(oldName);
  await tx.store.put({ name: trimmed });
  await tx.done;
}
