import type { DownloadMetadata, ID3Tags } from './types';
import type { ArtistMapping, AlbumRecord } from './db';

export async function downloadVideo(url: string, bitrate: number): Promise<DownloadMetadata> {
  const res = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, bitrate }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  return res.json();
}

export async function saveWithTags(
  fileId: string,
  tags: ID3Tags,
  filename: string
): Promise<Blob> {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, tags, filename }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  return res.blob();
}

export async function fetchImageFromUrl(url: string): Promise<{ image_b64: string; mime_type: string }> {
  const res = await fetch('/api/fetch-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  return res.json();
}

export function cancelDownload(fileId: string): void {
  navigator.sendBeacon(`/api/cancel/${fileId}`);
}

export interface AiAutofillPayload {
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: string;
  track_number: string;
  genre: string;
  youtube_title: string;
}

export interface AiAutofillSuggestions {
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: string;
  track_number: string;
  genre: string;
  album_art_url: string;
}

export async function getAiStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai-status');
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export async function aiAutofill(data: AiAutofillPayload): Promise<AiAutofillSuggestions> {
  const res = await fetch('/api/ai-autofill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  return res.json();
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Admin auth ----------------------------------------------------------

export async function loginAdmin(username: string, password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  const data = await res.json();
  return data.token as string;
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Admin config --------------------------------------------------------

function adminHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function base64ToBlob(b64: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

export async function getAdminMappings(token: string): Promise<ArtistMapping[]> {
  const res = await fetch('/api/admin/mappings', { headers: adminHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load mappings (${res.status})`);
  return res.json();
}

export async function putAdminMapping(token: string, mapping: ArtistMapping): Promise<void> {
  const res = await fetch('/api/admin/mappings', {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`Failed to save mapping (${res.status})`);
}

export async function deleteAdminMapping(token: string, raw: string): Promise<void> {
  const res = await fetch(`/api/admin/mappings/${encodeURIComponent(raw)}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to delete mapping (${res.status})`);
}

interface ServerAlbum {
  id: string;
  album_artist: string;
  album: string;
  genre: string;
  year: string;
  art_base64: string | null;
}

function serverAlbumToRecord(a: ServerAlbum): AlbumRecord {
  return {
    id: a.id,
    album_artist: a.album_artist,
    album: a.album,
    genre: a.genre,
    year: a.year,
    art: a.art_base64 ? base64ToBlob(a.art_base64) : null,
  };
}

export async function getAdminAlbums(token: string): Promise<AlbumRecord[]> {
  const res = await fetch('/api/admin/albums', { headers: adminHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load albums (${res.status})`);
  const data: ServerAlbum[] = await res.json();
  return data.map(serverAlbumToRecord);
}

export async function putAdminAlbum(token: string, record: AlbumRecord): Promise<void> {
  let art_base64: string | null = null;
  if (record.art) {
    art_base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(record.art!);
    });
  }
  const res = await fetch('/api/admin/albums', {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify({
      id: record.id,
      album_artist: record.album_artist,
      album: record.album,
      genre: record.genre,
      year: record.year,
      art_base64,
    }),
  });
  if (!res.ok) throw new Error(`Failed to save album (${res.status})`);
}

export async function deleteAdminAlbum(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/admin/albums/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to delete album (${res.status})`);
}
