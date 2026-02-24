import { useRef, useState } from 'react';
import {
  Music, User, Disc, Users, Calendar, Hash, Tag,
  Image as ImageIcon, Upload, X, Download, RotateCcw, Loader2
} from 'lucide-react';
import type { DownloadMetadata, ID3Tags } from '../types';

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

  function handleField(key: keyof Omit<ID3Tags, 'album_art_base64'>, value: string) {
    setTags((prev) => ({ ...prev, [key]: value }));
  }

  function handleArtUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(',')[1];
      setTags((prev) => ({ ...prev, album_art_base64: b64 }));
      setArtPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function removeArt() {
    setTags((prev) => ({ ...prev, album_art_base64: null }));
    setArtPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
              className="w-28 h-28 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer
                hover:border-brand-500/40 transition-all group relative"
              onClick={() => fileInputRef.current?.click()}
            >
              {artPreview ? (
                <>
                  <img src={artPreview} alt="Album art" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate-600 group-hover:text-slate-400 transition-colors">
                  <ImageIcon className="w-7 h-7" />
                  <span className="text-[10px] font-medium">Add Art</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">Album Artwork</p>
              <p className="text-xs text-slate-500">
                {artPreview ? 'Click the image to replace it' : 'Upload a cover image for this track'}
              </p>
              {metadata.thumbnail_b64 && !artPreview && (
                <p className="text-xs text-slate-600 mt-1">YouTube thumbnail was removed</p>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 border border-brand-500/30
                  text-brand-300 hover:bg-brand-600/30 transition-all text-xs font-medium cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                Upload image
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
