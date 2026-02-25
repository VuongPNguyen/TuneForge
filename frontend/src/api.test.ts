import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadVideo, saveWithTags, fetchImageFromUrl } from './api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), blob: () => Promise.resolve(new Blob()) };
}

function errResponse(data: unknown, status = 400) {
  return { ok: false, status, json: () => Promise.resolve(data), blob: () => Promise.resolve(new Blob()) };
}

beforeEach(() => mockFetch.mockReset());

// ---------------------------------------------------------------------------
// downloadVideo
// ---------------------------------------------------------------------------

describe('downloadVideo', () => {
  it('POSTs url and bitrate to /api/download', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ file_id: 'abc', title: 'Test' }));
    await downloadVideo('https://youtube.com/watch?v=abc', 256);
    expect(mockFetch).toHaveBeenCalledWith('/api/download', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtube.com/watch?v=abc', bitrate: 256 }),
    }));
  });

  it('returns parsed metadata on success', async () => {
    const meta = { file_id: 'abc', title: 'My Video', artist: 'Someone' };
    mockFetch.mockResolvedValueOnce(okResponse(meta));
    const result = await downloadVideo('https://youtube.com/watch?v=abc', 128);
    expect(result).toEqual(meta);
  });

  it('throws with the server detail message on error', async () => {
    mockFetch.mockResolvedValueOnce(errResponse({ detail: 'URL must be a valid YouTube URL' }));
    await expect(downloadVideo('https://vimeo.com/1', 256)).rejects.toThrow('URL must be a valid YouTube URL');
  });

  it('falls back to generic message when detail is missing', async () => {
    mockFetch.mockResolvedValueOnce(errResponse({}, 500));
    await expect(downloadVideo('https://youtube.com/watch?v=abc', 256)).rejects.toThrow('Server error 500');
  });
});

// ---------------------------------------------------------------------------
// saveWithTags
// ---------------------------------------------------------------------------

describe('saveWithTags', () => {
  it('POSTs to /api/save and returns a Blob on success', async () => {
    const blob = new Blob(['mp3 data'], { type: 'audio/mpeg' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, blob: () => Promise.resolve(blob) });
    const result = await saveWithTags('file-id', {} as never, 'Artist - Track');
    expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({ method: 'POST' }));
    expect(result).toBeInstanceOf(Blob);
  });

  it('encodes file_id, tags and filename in the request body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, blob: () => Promise.resolve(new Blob()) });
    const tags = { title: 'T', artist: 'A' } as never;
    await saveWithTags('id-123', tags, 'A - T');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.file_id).toBe('id-123');
    expect(body.filename).toBe('A - T');
    expect(body.tags).toEqual(tags);
  });

  it('throws with detail on 404', async () => {
    mockFetch.mockResolvedValueOnce(errResponse({ detail: 'File not found or expired' }, 404));
    await expect(saveWithTags('gone', {} as never, 'f')).rejects.toThrow('File not found or expired');
  });
});

// ---------------------------------------------------------------------------
// fetchImageFromUrl
// ---------------------------------------------------------------------------

describe('fetchImageFromUrl', () => {
  it('POSTs the url to /api/fetch-image', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ image_b64: 'abc', mime_type: 'image/jpeg' }));
    await fetchImageFromUrl('https://example.com/cover.jpg');
    expect(mockFetch).toHaveBeenCalledWith('/api/fetch-image', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/cover.jpg' }),
    }));
  });

  it('returns image_b64 and mime_type on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ image_b64: 'base64data', mime_type: 'image/jpeg' }));
    const result = await fetchImageFromUrl('https://example.com/img.jpg');
    expect(result).toEqual({ image_b64: 'base64data', mime_type: 'image/jpeg' });
  });

  it('throws with detail on 502', async () => {
    mockFetch.mockResolvedValueOnce(errResponse({ detail: 'Could not connect to the image URL' }, 502));
    await expect(fetchImageFromUrl('https://bad.example.com/img.jpg')).rejects.toThrow('Could not connect to the image URL');
  });

  it('throws with detail on private-IP SSRF block', async () => {
    mockFetch.mockResolvedValueOnce(errResponse({ detail: 'URL resolves to a private address' }, 400));
    await expect(fetchImageFromUrl('https://internal/img.jpg')).rejects.toThrow('URL resolves to a private address');
  });
});
