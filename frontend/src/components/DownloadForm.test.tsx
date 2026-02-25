import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadForm from './DownloadForm';

function setup(props?: { isLoading?: boolean }) {
  const onSubmit = vi.fn();
  render(<DownloadForm onSubmit={onSubmit} isLoading={props?.isLoading ?? false} />);
  return { onSubmit };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('DownloadForm rendering', () => {
  it('shows the page heading', () => {
    setup();
    expect(screen.getByRole('heading', { name: /youtube to mp3/i })).toBeInTheDocument();
  });

  it('renders the URL input', () => {
    setup();
    expect(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i)).toBeInTheDocument();
  });

  it('renders all four bitrate buttons', () => {
    setup();
    expect(screen.getByRole('button', { name: /96/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /128/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /256/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /320/i })).toBeInTheDocument();
  });

  it('marks 256 as the default bitrate via the DEFAULT badge', () => {
    setup();
    expect(screen.getByText('DEFAULT')).toBeInTheDocument();
  });

  it('disables inputs while loading', () => {
    setup({ isLoading: true });
    expect(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i)).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

describe('DownloadForm URL validation', () => {
  it('disables the submit button when the URL is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: /convert to mp3/i })).toBeDisabled();
  });

  it('shows an error for a non-YouTube URL', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i), 'https://vimeo.com/123');
    await user.click(screen.getByRole('button', { name: /convert to mp3/i }));
    expect(screen.getByText(/valid youtube video url/i)).toBeInTheDocument();
  });

  it('clears the error when the user starts typing after a validation error', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i);
    await user.type(input, 'https://vimeo.com/123');
    await user.click(screen.getByRole('button', { name: /convert to mp3/i }));
    expect(screen.getByText(/valid youtube video url/i)).toBeInTheDocument();
    await user.type(input, 'h');
    expect(screen.queryByText(/valid youtube video url/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

describe('DownloadForm submission', () => {
  it('calls onSubmit with the URL and default bitrate (256) on valid submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(
      screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    await user.click(screen.getByRole('button', { name: /convert to mp3/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 256);
  });

  it('calls onSubmit with the selected bitrate', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /320/i }));
    await user.type(
      screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i),
      'https://youtu.be/dQw4w9WgXcQ',
    );
    await user.click(screen.getByRole('button', { name: /convert to mp3/i }));
    expect(onSubmit).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ', 320);
  });

  it('does not call onSubmit with an invalid URL', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/i), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /convert to mp3/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Bitrate quality hint
// ---------------------------------------------------------------------------

describe('DownloadForm bitrate hints', () => {
  it('shows the 256 hint by default', () => {
    setup();
    expect(screen.getByText(/high quality.*recommended/i)).toBeInTheDocument();
  });

  it('updates the hint when 320 is selected', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /320/i }));
    expect(screen.getByText(/maximum quality/i)).toBeInTheDocument();
  });
});
