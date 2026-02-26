import { useRef, useState, useEffect } from 'react';
import {
  Music, User, Disc, Users, Calendar, Hash, Tag,
  Image as ImageIcon, Upload, X, Download, RotateCcw, Loader2,
  Lock, Link2, Wand2, BookmarkPlus, Check, AlertCircle,
  ArrowRight, Plus, Trash2, ChevronDown,
} from 'lucide-react';
import type { DownloadMetadata, ID3Tags } from '../types';
import { fetchImageFromUrl } from '../api';
import {
  getArtistMappings, putArtistMapping, deleteArtistMapping,
  getAlbums, deleteAlbum, putAlbum, albumKey, blobToBase64,
  type ArtistMapping, type AlbumRecord,
} from '../db';

interface Props {
  metadata: DownloadMetadata;
  onSave: (tags: ID3Tags) => void;
  isSaving: boolean;
  onReset: () => void;
  albumAutofilled?: boolean;
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

type MusicMode = 'covers' | 'singles' | 'albums';
type ActiveTab = 'default' | 'music';

const MODE_DESCRIPTIONS: Record<MusicMode, string> = {
  covers: 'Artist and album auto-sync to the album artist — e.g. "tripleS Covers"',
  singles: 'Album title mirrors the track title; artist follows album artist',
  albums: 'Bookmark genre, year and art so they autofill on future downloads',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TagEditor({ metadata, onSave, isSaving, onReset, albumAutofilled }: Props) {
  // ── Tag state ──────────────────────────────────────────────────────────────
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

  // ── Tab / mode state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('default');
  const [musicMode, setMusicMode] = useState<MusicMode | null>(null);
  const [albumSaveStatus, setAlbumSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autofillDismissed, setAutofillDismissed] = useState(false);
  const [liveAutofilled, setLiveAutofilled] = useState(false);

  // ── Settings state (loaded when Music tab is opened) ──────────────────────
  const [mappings, setMappings] = useState<ArtistMapping[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [albumArtUrls, setAlbumArtUrls] = useState<Record<string, string>>({});
  // Tracks the album key most recently auto-applied; seeded when albumAutofilled
  // is already true on mount so we don't re-fire for the initial load-time autofill.
  const lastAppliedAlbumKey = useRef<string | null>(
    albumAutofilled && metadata.album_artist && metadata.album
      ? albumKey(metadata.album_artist, metadata.album)
      : null
  );
  const [mappingsExpanded, setMappingsExpanded] = useState(false);
  const [albumsExpanded, setAlbumsExpanded] = useState(false);
  const [displayEdits, setDisplayEdits] = useState<Record<string, string>>({});
  const [newRaw, setNewRaw] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [addMappingError, setAddMappingError] = useState<string | null>(null);

  // True when a music mode is active that auto-computes certain fields
  const isSmartMode = activeTab === 'music' && (musicMode === 'covers' || musicMode === 'singles');

  // Load albums on mount so live matching works before the Music tab is opened
  useEffect(() => {
    getAlbums().then(setAlbums);
  }, []);

  // ── Load settings whenever the Music tab is entered ────────────────────────
  useEffect(() => {
    if (activeTab !== 'music') return;
    Promise.all([getArtistMappings(), getAlbums()]).then(([m, a]) => {
      setMappings(m);
      setAlbums(a);
    });
    setNewRaw('');
    setNewDisplay('');
    setAddMappingError(null);
    setDisplayEdits({});
  }, [activeTab]);

  // ── Live album matching: auto-apply when artist + album match a saved entry ─
  useEffect(() => {
    if (!tags.album_artist || !tags.album) {
      lastAppliedAlbumKey.current = null;
      return;
    }
    const key = albumKey(tags.album_artist, tags.album);
    if (key === lastAppliedAlbumKey.current) return;
    const match = albums.find((a) => a.id === key);
    if (!match) {
      lastAppliedAlbumKey.current = null;
      return;
    }
    lastAppliedAlbumKey.current = key;
    (async () => {
      let artBase64: string | null = null;
      let preview: string | null = null;
      if (match.art) {
        artBase64 = await blobToBase64(match.art);
        preview = `data:image/jpeg;base64,${artBase64}`;
      }
      setTags((prev) => ({
        ...prev,
        genre: match.genre || prev.genre,
        year: match.year || prev.year,
        ...(artBase64 ? { album_art_base64: artBase64 } : {}),
      }));
      if (preview) setArtPreview(preview);
      setLiveAutofilled(true);
      setAutofillDismissed(false);
    })();
  }, [tags.album_artist, tags.album, albums]);

  // Create / revoke object URLs for saved album art thumbnails
  useEffect(() => {
    const urls: Record<string, string> = {};
    albums.forEach((a) => { if (a.art) urls[a.id] = URL.createObjectURL(a.art); });
    setAlbumArtUrls(urls);
    return () => { Object.values(urls).forEach(URL.revokeObjectURL); };
  }, [albums]);

  // ── Tag field handlers ─────────────────────────────────────────────────────
  function handleField(key: keyof Omit<ID3Tags, 'album_art_base64'>, value: string) {
    if (activeTab === 'music' && musicMode) {
      setTags((prev) => {
        const next = { ...prev, [key]: value };
        if (musicMode === 'covers') {
          if (key === 'album_artist') {
            next.artist = value;
            next.album = value ? `${value} Covers` : '';
          }
        } else if (musicMode === 'singles') {
          if (key === 'title') {
            next.album = value;
          } else if (key === 'album_artist') {
            next.artist = value;
          }
        }
        return next;
      });
    } else {
      setTags((prev) => ({ ...prev, [key]: value }));
    }
  }

  function handleModeToggle(mode: MusicMode) {
    const newMode = musicMode === mode ? null : mode;
    setMusicMode(newMode);
    setAlbumSaveStatus('idle');

    if (mode === 'albums') return;

    setTags((prev) => {
      if (newMode === 'covers') {
        return {
          ...prev,
          artist: prev.album_artist,
          album: prev.album_artist ? `${prev.album_artist} Covers` : '',
        };
      }
      if (newMode === 'singles') {
        return { ...prev, album: prev.title };
      }
      return prev;
    });
  }

  // ── Album art handlers ─────────────────────────────────────────────────────
  function applyImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setTags((prev) => ({ ...prev, album_art_base64: dataUrl.split(',')[1] }));
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
    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
      const url = uriList.split('\n').map((l) => l.trim()).find(
        (l) => l && !l.startsWith('#') && /^https?:\/\//i.test(l)
      );
      if (url) return url;
    }
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
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) => /\.(png|jpe?g)$/i.test(f.name) || f.type.startsWith('image/'));
    if (imageFile) { applyImageFile(imageFile); return; }
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

  // ── Save album handler ─────────────────────────────────────────────────────
  async function handleSaveAlbum() {
    if (!tags.album_artist || !tags.album) return;
    setAlbumSaveStatus('saving');
    try {
      let artBlob: Blob | null = null;
      if (tags.album_art_base64) {
        const res = await fetch(`data:image/jpeg;base64,${tags.album_art_base64}`);
        artBlob = await res.blob();
      }
      await putAlbum({
        id: albumKey(tags.album_artist, tags.album),
        album_artist: tags.album_artist,
        album: tags.album,
        genre: tags.genre,
        year: tags.year,
        art: artBlob,
      });
      setAlbumSaveStatus('saved');
      // Refresh the saved albums list so the new entry appears immediately
      setAlbums(await getAlbums());
      setTimeout(() => setAlbumSaveStatus('idle'), 3000);
    } catch {
      setAlbumSaveStatus('error');
      setTimeout(() => setAlbumSaveStatus('idle'), 3000);
    }
  }

  // ── Settings handlers ──────────────────────────────────────────────────────
  async function handleDisplayBlur(raw: string) {
    const edited = displayEdits[raw];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    if (trimmed && trimmed !== mappings.find((m) => m.raw === raw)?.display) {
      await putArtistMapping({ raw, display: trimmed });
      setMappings((prev) => prev.map((m) => m.raw === raw ? { ...m, display: trimmed } : m));
    }
    setDisplayEdits((prev) => { const next = { ...prev }; delete next[raw]; return next; });
  }

  async function handleDeleteMapping(raw: string) {
    await deleteArtistMapping(raw);
    setMappings((prev) => prev.filter((m) => m.raw !== raw));
  }

  async function handleAddMapping() {
    const raw = newRaw.trim();
    const display = newDisplay.trim();
    if (!raw) { setAddMappingError('Channel name is required'); return; }
    if (!display) { setAddMappingError('Display name is required'); return; }
    setAddMappingError(null);
    await putArtistMapping({ raw, display });
    setMappings((prev) => {
      const exists = prev.find((m) => m.raw === raw);
      if (exists) return prev.map((m) => m.raw === raw ? { raw, display } : m);
      return [...prev, { raw, display }];
    });
    setNewRaw('');
    setNewDisplay('');
  }

  async function handleDeleteAlbum(id: string) {
    await deleteAlbum(id);
    setAlbums((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleApplyAlbum(album: AlbumRecord) {
    let artBase64: string | null = tags.album_art_base64;
    let preview: string | null = artPreview;

    if (album.art) {
      artBase64 = await blobToBase64(album.art);
      preview = `data:image/jpeg;base64,${artBase64}`;
    }

    setTags((prev) => ({
      ...prev,
      album_artist: album.album_artist,
      album: album.album,
      genre: album.genre ?? prev.genre,
      year: album.year ?? prev.year,
      album_art_base64: artBase64,
    }));
    setArtPreview(preview);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(tags);
  }

  const safeFilename = [tags.artist, tags.title].filter(Boolean).join(' - ') || metadata.title || 'download';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8 mb-6">
        {(['default', 'music'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            disabled={isSaving}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize cursor-pointer disabled:opacity-40
              ${activeTab === tab
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Music tab extras (mode + settings) ──────────────────────────────── */}
      {activeTab === 'music' && (
        <div className="space-y-2 mb-6">

          {/* Mode card */}
          <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mode</p>
            <div className="flex gap-2">
              {(['covers', 'singles', 'albums'] as MusicMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeToggle(mode)}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border cursor-pointer capitalize
                    ${musicMode === mode
                      ? 'bg-brand-600/30 border-brand-500/50 text-brand-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-300 hover:bg-white/8'
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {musicMode && (
              <p className="text-xs text-slate-500 leading-relaxed">
                {MODE_DESCRIPTIONS[musicMode]}
              </p>
            )}
          </div>

          {/* Artist Mappings — collapsible */}
          <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
            <button
              type="button"
              onClick={() => setMappingsExpanded((v) => !v)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/3 transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-300 flex-1">Artist Name Mappings</span>
              {mappings.length > 0 && (
                <span className="text-[10px] font-semibold bg-brand-600/25 text-brand-400 px-1.5 py-0.5 rounded-full">
                  {mappings.length}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform duration-200
                  ${mappingsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {mappingsExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/6">
                <p className="text-xs text-slate-500 leading-relaxed pt-3">
                  Automatically replaces a channel name with your preferred display name before the
                  tag editor opens.
                </p>

                {mappings.length === 0 ? (
                  <p className="text-sm text-slate-600">No mappings saved yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {mappings.map((m) => (
                      <div
                        key={m.raw}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/6"
                      >
                        <span className="text-sm text-slate-400 min-w-0 truncate flex-1" title={m.raw}>
                          {m.raw}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        <input
                          type="text"
                          value={displayEdits[m.raw] ?? m.display}
                          onChange={(e) =>
                            setDisplayEdits((prev) => ({ ...prev, [m.raw]: e.target.value }))
                          }
                          onBlur={() => handleDisplayBlur(m.raw)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none
                            border-b border-transparent hover:border-white/20 focus:border-brand-500/60
                            transition-colors px-0.5"
                          aria-label={`Display name for ${m.raw}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteMapping(m.raw)}
                          className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                          aria-label={`Delete mapping for ${m.raw}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add form */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Add mapping</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newRaw}
                      onChange={(e) => { setNewRaw(e.target.value); setAddMappingError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddMapping(); }}
                      placeholder="Channel name (exact)"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                        text-white text-sm placeholder-slate-600 outline-none
                        focus:border-brand-500/60 focus:bg-white/8 transition-all"
                    />
                    <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                    <input
                      type="text"
                      value={newDisplay}
                      onChange={(e) => { setNewDisplay(e.target.value); setAddMappingError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddMapping(); }}
                      placeholder="Display name"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                        text-white text-sm placeholder-slate-600 outline-none
                        focus:border-brand-500/60 focus:bg-white/8 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddMapping}
                      disabled={!newRaw.trim() || !newDisplay.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600/20 border border-brand-500/30
                        text-brand-300 hover:bg-brand-600/30 transition-all text-sm font-medium
                        cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                  {addMappingError && <p className="text-xs text-red-400">{addMappingError}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Saved Albums — collapsible */}
          <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
            <button
              type="button"
              onClick={() => setAlbumsExpanded((v) => !v)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/3 transition-colors cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-300 flex-1">Saved Albums</span>
              {albums.length > 0 && (
                <span className="text-[10px] font-semibold bg-brand-600/25 text-brand-400 px-1.5 py-0.5 rounded-full">
                  {albums.length}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform duration-200
                  ${albumsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {albumsExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/6">
                <p className="text-xs text-slate-500 leading-relaxed pt-3">
                  When a download's album artist and album title match a saved entry, genre, year
                  and art are autofilled automatically. Use Albums mode above to save an album.
                </p>

                {albums.length === 0 ? (
                  <p className="text-sm text-slate-600">No albums saved yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {albums.map((album) => (
                      <div
                        key={album.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6"
                      >
                        <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                          {albumArtUrls[album.id] ? (
                            <img
                              src={albumArtUrls[album.id]}
                              alt={album.album}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Disc className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{album.album}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {album.album_artist}
                            {(album.genre || album.year) && (
                              <span className="text-slate-600">
                                {' · '}{[album.genre, album.year].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyAlbum(album)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-brand-600/20 border border-brand-500/30
                            text-brand-300 hover:bg-brand-600/30 transition-all text-xs font-medium cursor-pointer flex-shrink-0"
                          aria-label={`Apply album ${album.album}`}
                        >
                          <Wand2 className="w-3 h-3" />
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAlbum(album.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                          aria-label={`Delete saved album ${album.album}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Autofill notice */}
      {(albumAutofilled || liveAutofilled) && !autofillDismissed && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-brand-600/10 border border-brand-500/20 mb-6">
          <Wand2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span className="text-sm text-brand-300 flex-1">
            Genre, year and album art autofilled from saved album
          </span>
          <button
            type="button"
            onClick={() => setAutofillDismissed(true)}
            className="text-brand-500 hover:text-brand-300 transition-colors cursor-pointer"
            aria-label="Dismiss autofill notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Tag form ─────────────────────────────────────────────────────────── */}
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
              {isDragOver && (
                <div className="absolute inset-[3px] rounded-lg border-2 border-dashed border-brand-400/70 pointer-events-none z-10" />
              )}
              {isUrlFetching && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900/80 rounded-xl z-20">
                  <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                  <span className="text-[10px] font-semibold text-brand-300">Fetching...</span>
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
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={artUrl}
                  onChange={(e) => { setArtUrl(e.target.value); setArtUrlError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyImageUrl(artUrl); } }}
                  placeholder="Paste image URL..."
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
          {FIELDS.map((field) => {
            const isLocked = field.key === 'album' && isSmartMode;
            const isArtistSynced = field.key === 'artist' && isSmartMode;

            return (
              <div key={field.key} className={field.key === 'title' ? 'sm:col-span-2' : ''}>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  <span className="text-slate-500">{field.icon}</span>
                  {field.label}
                  {isLocked && (
                    <span className="ml-auto flex items-center gap-1 text-slate-600 normal-case font-normal tracking-normal">
                      <Lock className="w-3 h-3" />
                      <span className="text-[10px]">auto</span>
                    </span>
                  )}
                  {isArtistSynced && (
                    <span className="ml-auto flex items-center gap-1 text-slate-600 normal-case font-normal tracking-normal">
                      <Link2 className="w-3 h-3" />
                      <span className="text-[10px]">follows Album Artist</span>
                    </span>
                  )}
                </label>
                <input
                  type={field.type || 'text'}
                  value={tags[field.key]}
                  onChange={(e) => handleField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  disabled={isSaving || isLocked}
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all
                    ${isLocked
                      ? 'bg-white/3 border-white/5 text-slate-400 cursor-not-allowed placeholder-slate-700'
                      : 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-brand-500/60 focus:bg-white/8 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                />
              </div>
            );
          })}
        </div>

        {/* Output filename preview */}
        <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/8">
          <p className="text-xs text-slate-500 mb-1">Output filename</p>
          <p className="text-sm text-slate-300 font-mono truncate">{safeFilename}.mp3</p>
        </div>

        {/* Save album — only shown in albums mode */}
        {activeTab === 'music' && musicMode === 'albums' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/8">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 truncate">
                {tags.album_artist && tags.album
                  ? <><span className="text-white">{tags.album_artist}</span> — {tags.album}</>
                  : <span className="text-slate-500">Fill in Album Artist and Album to save</span>
                }
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Saves genre, year and art for future autofill
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveAlbum}
              disabled={!tags.album_artist || !tags.album || albumSaveStatus === 'saving' || isSaving}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium
                transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0
                ${albumSaveStatus === 'saved'
                  ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300'
                  : albumSaveStatus === 'error'
                  ? 'bg-red-600/20 border-red-500/30 text-red-300'
                  : 'bg-brand-600/20 border-brand-500/30 text-brand-300 hover:bg-brand-600/30'
                }`}
            >
              {albumSaveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {albumSaveStatus === 'saved' && <Check className="w-3.5 h-3.5" />}
              {albumSaveStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
              {albumSaveStatus === 'idle' && <BookmarkPlus className="w-3.5 h-3.5" />}
              {albumSaveStatus === 'saving' ? 'Saving…'
                : albumSaveStatus === 'saved' ? 'Saved!'
                : albumSaveStatus === 'error' ? 'Failed'
                : 'Save album'}
            </button>
          </div>
        )}

        {/* Download button */}
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
              Saving...
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
