import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagEditor from './TagEditor';
import type { DownloadMetadata } from '../types';

// Mock the API module so tests never hit the network
vi.mock('../api', () => ({
  fetchImageFromUrl: vi.fn(),
}));
import { fetchImageFromUrl } from '../api';
const mockFetchImageFromUrl = vi.mocked(fetchImageFromUrl);
import { getGenreNames } from '../db';
const mockGetGenreNames = vi.mocked(getGenreNames);

// Mock the db module so tests never touch IndexedDB (unavailable in JSDOM)
vi.mock('../db', () => ({
  getArtistMappings: vi.fn().mockResolvedValue([]),
  putArtistMapping: vi.fn().mockResolvedValue(undefined),
  deleteArtistMapping: vi.fn().mockResolvedValue(undefined),
  getAlbums: vi.fn().mockResolvedValue([]),
  deleteAlbum: vi.fn().mockResolvedValue(undefined),
  putAlbum: vi.fn().mockResolvedValue(undefined),
  albumKey: vi.fn((artist: string, album: string) => `${artist}::${album}`),
  blobToBase64: vi.fn().mockResolvedValue(''),
  getGenreNames: vi.fn().mockResolvedValue([]),
  putGenreName: vi.fn().mockResolvedValue(undefined),
  deleteGenreName: vi.fn().mockResolvedValue(undefined),
  renameGenreName: vi.fn().mockResolvedValue(undefined),
}));

const BASE_METADATA: DownloadMetadata = {
  file_id: 'test-file-id',
  title: 'Test Track',
  artist: 'Test Artist',
  album: 'Test Album',
  album_artist: 'Test Artist',
  year: '2024',
  track_number: '1',
  genre: 'Electronic',
  thumbnail_b64: null,
  duration: 185,
  webpage_url: 'https://www.youtube.com/watch?v=test',
};

function setup(overrides?: Partial<DownloadMetadata>) {
  const onSave = vi.fn();
  const onReset = vi.fn();
  const metadata = { ...BASE_METADATA, ...overrides };
  render(
    <TagEditor
      metadata={metadata}
      onSave={onSave}
      isSaving={false}
      onReset={onReset}
    />
  );
  return { onSave, onReset };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('TagEditor rendering', () => {
  it('shows the Edit ID3 Tags heading', () => {
    setup();
    expect(screen.getByRole('heading', { name: /edit id3 tags/i })).toBeInTheDocument();
  });

  it('pre-fills the title field with metadata', () => {
    setup();
    expect(screen.getByDisplayValue('Test Track')).toBeInTheDocument();
  });

  it('pre-fills the artist field with metadata', () => {
    setup();
    // Both artist and album_artist fields contain 'Test Artist'
    const fields = screen.getAllByDisplayValue('Test Artist');
    expect(fields.length).toBeGreaterThanOrEqual(1);
    expect(fields[0]).toBeInTheDocument();
  });

  it('shows the output filename preview with sanitized filename', () => {
    setup();
    expect(screen.getByText(/Test Artist - Test Track\.mp3/)).toBeInTheDocument();
  });

  it('shows the duration when provided', () => {
    setup({ duration: 185 });
    expect(screen.getByText('3:05')).toBeInTheDocument();
  });

  it('prefills Artist Name Mapping channel field with current artist', async () => {
    const user = userEvent.setup();
    setup();

    // Switch to Music tab
    await user.click(screen.getByRole('button', { name: /music/i }));

    // Expand Artist Name Mappings section
    await user.click(screen.getByRole('button', { name: /artist name mappings/i }));

    // The "Channel name (exact)" input should be prefilled with the current artist
    const channelInput = screen.getByPlaceholderText(/channel name \(exact\)/i) as HTMLInputElement;
    expect(channelInput.value).toBe('Test Artist');
  });

  it('prefills Artist Name Mapping channel field with original artist', async () => {
    const user = userEvent.setup();
    setup({ artist: 'Mapped Display', original_artist: 'Original Channel' });

    // Switch to Music tab
    await user.click(screen.getByRole('button', { name: /music/i }));

    // Expand Artist Name Mappings section
    await user.click(screen.getByRole('button', { name: /artist name mappings/i }));

    // "Channel name (exact)" should use the preserved original channel name
    const channelInput = screen.getByPlaceholderText(/channel name \(exact\)/i) as HTMLInputElement;
    expect(channelInput.value).toBe('Original Channel');
  });

  it('updates current artist and album artist after adding mapping', async () => {
    const user = userEvent.setup();
    setup({ artist: 'Test Artist', album_artist: 'Test Artist' });

    // Switch to Music tab
    await user.click(screen.getByRole('button', { name: /music/i }));

    // Expand Artist Name Mappings section
    await user.click(screen.getByRole('button', { name: /artist name mappings/i }));

    const artistInput = screen.getByPlaceholderText('Artist name') as HTMLInputElement;
    const albumArtistInput = screen.getByPlaceholderText('Album artist name') as HTMLInputElement;
    expect(artistInput.value).toBe('Test Artist');
    expect(albumArtistInput.value).toBe('Test Artist');

    // "Channel name (exact)" is prefilled; we only need to set display name.
    const displayInput = screen.getByPlaceholderText(/display name/i) as HTMLInputElement;
    await user.clear(displayInput);
    await user.type(displayInput, 'Mapped Display');

    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(artistInput.value).toBe('Mapped Display');
      expect(albumArtistInput.value).toBe('Mapped Display');
    });
  });

  it('does not show a remove button when there is no art', () => {
    setup({ thumbnail_b64: null });
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('shows the removed thumbnail notice when thumbnail exists but art was cleared', () => {
    setup({ thumbnail_b64: 'abc123' });
    // thumbnail_b64 is used to pre-fill artPreview; since it's set, "Remove" should appear
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Field editing
// ---------------------------------------------------------------------------

describe('TagEditor field editing', () => {
  it('updates the filename preview when title changes', async () => {
    const user = userEvent.setup();
    setup();
    const titleInput = screen.getByDisplayValue('Test Track');
    await user.clear(titleInput);
    await user.type(titleInput, 'New Title');
    expect(screen.getByText(/Test Artist - New Title\.mp3/)).toBeInTheDocument();
  });

  it('updates the filename preview when album artist changes', async () => {
    const user = userEvent.setup();
    setup();
    const albumArtistInput = screen.getByPlaceholderText('Album artist name');
    await user.clear(albumArtistInput);
    await user.type(albumArtistInput, 'New Album Artist');
    await waitFor(() => {
      expect(screen.getByText(/New Album Artist - Test Track\.mp3/)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Album art — file upload
// ---------------------------------------------------------------------------

describe('TagEditor album art file upload', () => {
  it('shows a preview after a valid image file is dropped via file input', async () => {
    const user = userEvent.setup();
    setup();

    const file = new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Mock FileReader to return a data URL
    const readAsDataURLSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/jpeg;base64,fakebase64' });
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    });

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText('Album art')).toBeInTheDocument();
    });

    readAsDataURLSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Album art — remove
// ---------------------------------------------------------------------------

describe('TagEditor remove album art', () => {
  it('hides the preview and remove button after clicking Remove', async () => {
    const user = userEvent.setup();
    setup({ thumbnail_b64: 'abc123' });

    const removeBtn = screen.getByRole('button', { name: /remove/i });
    await user.click(removeBtn);

    expect(screen.queryByAltText('Album art')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Album art — URL input
// ---------------------------------------------------------------------------

describe('TagEditor album art URL input', () => {
  beforeEach(() => mockFetchImageFromUrl.mockReset());

  it('applies the image when a valid URL is entered and Apply is clicked', async () => {
    const user = userEvent.setup();
    setup();
    mockFetchImageFromUrl.mockResolvedValueOnce({ image_b64: 'newbase64', mime_type: 'image/jpeg' });

    const urlInput = screen.getByPlaceholderText(/paste image url/i);
    await user.type(urlInput, 'https://example.com/cover.jpg');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByAltText('Album art')).toBeInTheDocument();
    });
    expect(mockFetchImageFromUrl).toHaveBeenCalledWith('https://example.com/cover.jpg');
  });

  it('clears the URL input after a successful apply', async () => {
    const user = userEvent.setup();
    setup();
    mockFetchImageFromUrl.mockResolvedValueOnce({ image_b64: 'x', mime_type: 'image/jpeg' });

    const urlInput = screen.getByPlaceholderText(/paste image url/i);
    await user.type(urlInput, 'https://example.com/cover.jpg');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(urlInput).toHaveValue(''));
  });

  it('shows an error message when the fetch fails', async () => {
    const user = userEvent.setup();
    setup();
    mockFetchImageFromUrl.mockRejectedValueOnce(new Error('Could not connect to the image URL'));

    const urlInput = screen.getByPlaceholderText(/paste image url/i);
    await user.type(urlInput, 'https://bad.example.com/img.jpg');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not connect to the image url/i)).toBeInTheDocument();
    });
  });

  it('clears the error when the user types in the URL field after a failure', async () => {
    const user = userEvent.setup();
    setup();
    mockFetchImageFromUrl.mockRejectedValueOnce(new Error('Some error'));

    const urlInput = screen.getByPlaceholderText(/paste image url/i);
    await user.type(urlInput, 'https://bad.example.com/img.jpg');
    await user.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => expect(screen.getByText(/some error/i)).toBeInTheDocument());

    await user.type(urlInput, 'a');
    expect(screen.queryByText(/some error/i)).not.toBeInTheDocument();
  });

  it('Apply button is disabled when the URL input is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
  });

  it('applies the image when Enter is pressed in the URL field', async () => {
    const user = userEvent.setup();
    setup();
    mockFetchImageFromUrl.mockResolvedValueOnce({ image_b64: 'b64', mime_type: 'image/jpeg' });

    const urlInput = screen.getByPlaceholderText(/paste image url/i);
    await user.type(urlInput, 'https://example.com/cover.jpg{Enter}');

    await waitFor(() => expect(screen.getByAltText('Album art')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

describe('TagEditor form submission', () => {
  it('calls onSave with the current tags on submit', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.click(screen.getByRole('button', { name: /save & download/i }));

    expect(onSave).toHaveBeenCalledOnce();
    const tags = onSave.mock.calls[0][0];
    expect(tags.title).toBe('Test Track');
    expect(tags.artist).toBe('Test Artist');
    expect(tags.year).toBe('2024');
    expect(tags.comment).toBe(BASE_METADATA.webpage_url);
  });

  it('does not submit when the outer form Enter key is pressed inside the URL input', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    // Pressing Enter in URL field should NOT trigger onSave
    mockFetchImageFromUrl.mockResolvedValueOnce({ image_b64: 'x', mime_type: 'image/jpeg' });
    const urlInput = screen.getByPlaceholderText(/paste image url/i);
    await user.type(urlInput, 'https://example.com/img.jpg{Enter}');
    // onSave must not be called; only fetchImageFromUrl should have been called
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onReset when New download is clicked', async () => {
    const user = userEvent.setup();
    const { onReset } = setup();
    // Two "New download" buttons exist (header and footer); click the first one
    await user.click(screen.getAllByRole('button', { name: /new download/i })[0]);
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('disables the save button and shows Saving… while isSaving=true', () => {
    const onSave = vi.fn();
    render(
      <TagEditor metadata={BASE_METADATA} onSave={onSave} isSaving={true} onReset={vi.fn()} />
    );
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Genre autocomplete
// ---------------------------------------------------------------------------

describe('TagEditor genre autocomplete', () => {
  beforeEach(() => {
    mockGetGenreNames.mockResolvedValue(['Synth-pop']);
  });

  it('shows an obvious preview and applies the saved genre on Tab', async () => {
    const user = userEvent.setup();
    setup({ genre: 'Synth' });

    await waitFor(() => {
      expect(screen.getByText(/Preview: Synth-pop/i)).toBeInTheDocument();
    });

    const genreInput = document.getElementById('tag-genre') as HTMLInputElement;
    await user.click(genreInput);
    await user.keyboard('{Tab}');

    expect(genreInput).toHaveValue('Synth-pop');
  });

  it('applies the saved genre when the caret is at the end and Right Arrow is pressed', async () => {
    setup({ genre: 'Synth' });

    await waitFor(() => expect(screen.getByText(/Preview: Synth-pop/i)).toBeInTheDocument());

    const genreInput = document.getElementById('tag-genre') as HTMLInputElement;
    genreInput.focus();
    genreInput.setSelectionRange(5, 5);
    fireEvent.keyDown(genreInput, { key: 'ArrowRight' });

    expect(genreInput).toHaveValue('Synth-pop');
  });
});
