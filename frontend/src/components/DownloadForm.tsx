import { useState } from 'react';
import { Music, Link, Zap } from 'lucide-react';

interface Props {
  onSubmit: (url: string, bitrate: number) => void;
  isLoading: boolean;
}

const BITRATES = [96, 128, 256, 320] as const;

export default function DownloadForm({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('');
  const [bitrate, setBitrate] = useState<number>(256);
  const [urlError, setUrlError] = useState('');

  function validateUrl(value: string): boolean {
    const ALLOWED_HOSTNAMES = new Set([
      'www.youtube.com',
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtu.be',
    ]);
    try {
      const u = new URL(value);
      return (
        (u.protocol === 'http:' || u.protocol === 'https:') &&
        ALLOWED_HOSTNAMES.has(u.hostname)
      );
    } catch {
      return false;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setUrlError('Please enter a YouTube URL');
      return;
    }
    if (!validateUrl(url.trim())) {
      setUrlError('Please enter a valid YouTube video URL');
      return;
    }
    setUrlError('');
    onSubmit(url.trim(), bitrate);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-6 shadow-lg shadow-brand-500/10">
          <Music className="w-9 h-9 text-brand-400" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          YouTube to MP3
        </h1>
        <p className="text-slate-400 text-lg">
          Convert any YouTube video to a high-quality MP3 with custom ID3 tags.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            YouTube URL
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Link className="w-4 h-4 text-slate-500" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isLoading}
              className={`w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/5 border transition-all outline-none text-white placeholder-slate-600 text-sm
                ${urlError
                  ? 'border-red-500/60 focus:border-red-400'
                  : 'border-white/10 focus:border-brand-500/60 focus:bg-white/8'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>
          {urlError && (
            <p className="mt-2 text-sm text-red-400">{urlError}</p>
          )}
        </div>

        {/* Bitrate Selector */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Audio Bitrate
          </label>
          <div className="grid grid-cols-4 gap-3">
            {BITRATES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBitrate(b)}
                disabled={isLoading}
                className={`relative py-3 px-2 rounded-xl border text-sm font-semibold transition-all duration-150 cursor-pointer
                  ${bitrate === b
                    ? 'bg-brand-600/30 border-brand-500/60 text-brand-300 shadow-md shadow-brand-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8 hover:border-white/20 hover:text-slate-300'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="block text-base">{b}</span>
                <span className="block text-xs font-normal opacity-70 mt-0.5">kb/s</span>
                {b === 256 && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    DEFAULT
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-xs text-slate-500">
              {bitrate === 320
                ? 'Maximum quality — largest file size'
                : bitrate === 256
                ? 'High quality — recommended for most uses'
                : bitrate === 128
                ? 'Standard quality — smaller file size'
                : 'Low quality — minimum file size'}
            </p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-semibold text-base transition-all duration-150 shadow-lg shadow-brand-600/25
            hover:shadow-brand-500/30 active:scale-[0.99] cursor-pointer"
        >
          Convert to MP3
        </button>
      </form>
    </div>
  );
}
