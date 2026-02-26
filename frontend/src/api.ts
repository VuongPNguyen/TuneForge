import type { DownloadMetadata, ID3Tags } from './types';

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
