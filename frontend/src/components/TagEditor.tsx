import { useRef, useState } from 'react';
import {
  Music, User, Disc, Users, Calendar, Hash, Tag,
  Image as ImageIcon, Upload, X, Download, RotateCcw, Loader2
} from 'lucide-react';
import type { DownloadMetadata, ID3Tags } from '../types';
import { fetchImageFromUrl } from '../api';

interface Props {
  metadata: DownloadMetadata;
  onSave: (tags: ID3Tags) => void;
  isSaving: boolean;
  onReset: () => void;
}

interface FieldConfig {
  key: keyof Omit<ID3Tags, 'album_art_base64'>;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  type?: string;
  maxLength?: number;
}

const FIELDS: FieldConfig[] = [
  { key: 'title', label: 'Title', placeholder: 'Track title', icon: <Music className="w-4 h-4" /> },
  { key: 'artist', label: 'Artist', placeholder: 'Artist name', icon: <User className="w-4 h-4" /> },
  { key: 'album', label: 'Album', placeholder: 'Album name', icon: <Disc className="w-4 h-4" /> },
  { key: 'album_artist', label: 'Album Artist', placeholder: 'Album artist name', icon: <Users className="w-4 h-4" /> },
  { key: 'year', label: 'Year', placeholder: 'e.g. 2024', icon: <Calendar className="w-4 h-4" />, type: 'text', maxLength: 4 },
  { key: 'track_number', label: 'Track Number', placeholder: 'e.g. 1 or 1/12', icon: <Hash className="w-4 h-4" /> },
  { key: 'genre', label: 'Genre', placeholder: 'e.g. Electronic', icon: <Tag className="w-4 h-4" /> },
];

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TagEditor({ metadata, onSave, isSaving, onReset }: Props) {
  const [tags, setTags] = useState<ID3Tags>({
    title: metadata.title || '',
    artist: metadata.artist || '',
    album: metadata.album || '',
    album_artist: metadata.album_artist || '',
    year: metadata.year || '',
    track_number: metadata.track_number || '',
    genre: metadata.genre || '',
    album_art_base64: metadata.thumbnail_b64 || null,
  });

  const [artPreview, setArtPreview] = useState<string | null>(
    metadata.thumbnail_b64 ? `data:image/jpeg;base64,${metadata.thumbnail_b64}` : null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUrlFetching, setIsUrlFetching] = useState(false);
  const [artUrl, setArtUrl] = useState('');
  const [artUrlError, setArtUrlError] = useState<string | null>(null);

  function handleField(key: keyof Omit<ID3Tags, 'album_art_base64'>, value: string) {
    setTags((prev) => ({ ...prev, [key]: value }));
  }

  function applyImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(',')[1];
      setTags((prev) => ({ ...prev, album_art_base64: b64 }));
      setArtPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleArtUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageFile(file);
  }

  function extractImageUrl(dataTransfer: DataTransfer): string | null {
    // text/uri-list: one URL per line, lines starting with # are comments
    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
      const url = uriList.split('\n').map((l) => l.trim()).find(
        (l) => l && !l.startsWith('#') && /^https?:\/\//i.test(l)
      );
      if (url) return url;
    }
    // text/html: parse <img src="..."> from dragged HTML snippet
    const html = dataTransfer.getData('text/html');
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match?.[1] && /^https?:\/\//i.test(match[1])) return match[1];
    }
    return null;
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const types = e.dataTransfer.types;
    if (types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);

    // Prefer a directly dropped image file
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) =>
      /\.(png|jpe?g)$/i.test(f.name) || f.type.startsWith('image/')
    );
    if (imageFile) { applyImageFile(imageFile); return; }

    // Fall back to extracting a URL from the dragged content
    const url = extractImageUrl(e.dataTransfer);
    if (url) await applyImageUrl(url);
  }

  function removeArt() {
    setTags((prev) => ({ ...prev, album_art_base64: null }));
    setArtPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function applyImageUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    setIsUrlFetching(true);
    setArtUrlError(null);
    try {
      const { image_b64, mime_type } = await fetchImageFromUrl(trimmed);
      setTags((prev) => ({ ...prev, album_art_base64: image_b64 }));
      setArtPreview(`data:${mime_type};base64,${image_b64}`);
      setArtUrl('');
    } catch (err) {
      setArtUrlError(err instanceof Error ? err.message : 'Failed to fetch image');
    } finally {
      setIsUrlFetching(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(tags);
  }

  const safeFilename = [tags.artist, tags.title].filter(Boolean).join(' - ') || metadata.title || 'download';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Edit ID3 Tags</h2>
          <p className="text-slate-400 text-sm mt-1">Customize the metadata for your MP3 file</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10
            text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm cursor-pointer disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New download
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Album Art */}
        <div className="flex gap-5 p-5 rounded-2xl bg-white/3 border border-white/8">
          <div className="flex-shrink-0">
            <div
              className={`w-28 h-28 rounded-xl bg-white/5 border flex items-center justify-center cursor-pointer
                transition-all duration-150 group relative
                ${isDragOver
                  ? 'border-brand-400 bg-brand-500/15 scale-105 shadow-lg shadow-brand-500/30'
                  : 'border-white/10 hover:border-brand-500/40 overflow-hidden'
                }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Animated dashed border on drag */}
              {isDragOver && (
                <div className="absolute inset-[3px] rounded-lg border-2 border-dashed border-brand-400/70 pointer-events-none z-10" />
              )}

              {/* URL fetch spinner */}
              {isUrlFetching && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900/80 rounded-xl z-20">
                  <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                  <span className="text-[10px] font-semibold text-brand-300">Fetching…</span>
                </div>
              )}

              {artPreview ? (
                <>
                  <img src={artPreview} alt="Album art" className="w-full h-full object-cover rounded-xl" />
                  <div className={`absolute inset-0 transition-opacity flex flex-col items-center justify-center gap-1 rounded-xl
                    ${isDragOver ? 'opacity-100 bg-brand-900/80' : 'opacity-0 group-hover:opacity-100 bg-black/60'}`}>
                    {isDragOver ? (
                      <>
                        <ImageIcon className="w-6 h-6 text-brand-300" />
                        <span className="text-[10px] font-semibold text-brand-300">Drop to replace</span>
                      </>
                    ) : (
                      <Upload className="w-5 h-5 text-white" />
                    )}
                  </div>
                </>
              ) : (
                <div className={`flex flex-col items-center gap-1.5 transition-colors z-10
                  ${isDragOver ? 'text-brand-300' : 'text-slate-600 group-hover:text-slate-400'}`}>
                  <ImageIcon className="w-7 h-7" />
                  <span className="text-[10px] font-semibold">{isDragOver ? 'Drop here' : 'Add Art'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between min-w-0 gap-3">
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">Album Artwork</p>
              <p className="text-xs text-slate-500">
                {artPreview ? 'Click or drop an image to replace it' : 'Upload, drop, or paste a URL'}
              </p>
              {metadata.thumbnail_b64 && !artPreview && (
                <p className="text-xs text-slate-600 mt-1">YouTube thumbnail was removed</p>
              )}
            </div>

            {/* File upload + remove buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 border border-brand-500/30
                  text-brand-300 hover:bg-brand-600/30 transition-all text-xs font-medium cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                Upload file
              </button>
              {artPreview && (
                <button
                  type="button"
                  onClick={removeArt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
                    text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all text-xs font-medium cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              )}
            </div>

            {/* URL input row */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={artUrl}
                  onChange={(e) => { setArtUrl(e.target.value); setArtUrlError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyImageUrl(artUrl); } }}
                  placeholder="Paste image URL…"
                  disabled={isUrlFetching}
                  className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/5 border text-white text-xs
                    placeholder-slate-600 outline-none focus:bg-white/8 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${artUrlError ? 'border-red-500/60 focus:border-red-500/80' : 'border-white/10 focus:border-brand-500/60'}`}
                />
                <button
                  type="button"
                  onClick={() => applyImageUrl(artUrl)}
                  disabled={!artUrl.trim() || isUrlFetching}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
                    text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-medium
                    cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isUrlFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                  Apply
                </button>
              </div>
              {artUrlError && (
                <p className="text-[11px] text-red-400 leading-tight">{artUrlError}</p>
              )}
            </div>
          </div>

          {metadata.duration && (
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-slate-500">Duration</p>
              <p className="text-sm font-mono text-slate-300 mt-0.5">{formatDuration(metadata.duration)}</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleArtUpload}
        />

        {/* Tag fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map((field) => (
            <div
              key={field.key}
              className={field.key === 'title' ? 'sm:col-span-2' : ''}
            >
              <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                <span className="text-slate-500">{field.icon}</span>
                {field.label}
              </label>
              <input
                type={field.type || 'text'}
                value={tags[field.key]}
                onChange={(e) => handleField(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                disabled={isSaving}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600
                  text-sm outline-none focus:border-brand-500/60 focus:bg-white/8 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          ))}
        </div>

        {/* Output filename preview */}
        <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/8">
          <p className="text-xs text-slate-500 mb-1">Output filename</p>
          <p className="text-sm text-slate-300 font-mono truncate">{safeFilename}.mp3</p>
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-semibold text-base transition-all duration-150 shadow-lg shadow-brand-600/25
            hover:shadow-brand-500/30 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-3"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Save & Download MP3
            </>
          )}
        </button>
      </form>
    </div>
  );
}
