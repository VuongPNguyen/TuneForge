import { useState, useEffect } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import DownloadForm from './components/DownloadForm';
import LoadingState from './components/LoadingState';
import TagEditor from './components/TagEditor';
import ErrorAlert from './components/ErrorAlert';
import LoginModal from './components/LoginModal';
import { downloadVideo, saveWithTags, triggerDownload, cancelDownload } from './api';
import {
  verifyAdminToken,
  getAdminMappings,
  getAdminAlbums,
  getAiStatus,
} from './api';
import { lookupArtist, lookupAlbum, blobToBase64 } from './db';
import type { AppStep, DownloadMetadata, ID3Tags } from './types';
import type { ArtistMapping, AlbumRecord } from './db';

const STORAGE_KEY = 'admin_token';

export default function App() {
  const [step, setStep] = useState<AppStep>('input');
  const [metadata, setMetadata] = useState<DownloadMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [albumAutofilled, setAlbumAutofilled] = useState(false);
  const [savedFile, setSavedFile] = useState<{ blob: Blob; filename: string; tags: ID3Tags } | null>(null);

  // ── Admin auth state ───────────────────────────────────────────────────────
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminMappings, setAdminMappings] = useState<ArtistMapping[]>([]);
  const [adminAlbums, setAdminAlbums] = useState<AlbumRecord[]>([]);
  const [adminConfigError, setAdminConfigError] = useState<string | null>(null);

  // ── AI availability ────────────────────────────────────────────────────────
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  // Verify stored token, load admin config, and check AI availability on mount
  useEffect(() => {
    getAiStatus().then(setAiAvailable);

    if (!adminToken) return;
    (async () => {
      const valid = await verifyAdminToken(adminToken);
      if (!valid) {
        localStorage.removeItem(STORAGE_KEY);
        setAdminToken(null);
        return;
      }
      setIsAdmin(true);
      try {
        const [mappings, albums] = await Promise.all([
          getAdminMappings(adminToken),
          getAdminAlbums(adminToken),
        ]);
        setAdminMappings(mappings);
        setAdminAlbums(albums);
      } catch {
        setAdminConfigError('Failed to load your saved settings from the server. Your data is safe — try refreshing.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogin(token: string) {
    localStorage.setItem(STORAGE_KEY, token);
    setAdminToken(token);
    setIsAdmin(true);
    setShowLoginModal(false);
    Promise.all([getAdminMappings(token), getAdminAlbums(token)]).then(([m, a]) => {
      setAdminMappings(m);
      setAdminAlbums(a);
    });
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAdminToken(null);
    setIsAdmin(false);
    setAdminMappings([]);
    setAdminAlbums([]);
  }

  async function handleDownload(url: string, bitrate: number) {
    setError(null);
    setStep('downloading');
    setAlbumAutofilled(false);
    try {
      const data = await downloadVideo(url, bitrate);

      if (isAdmin) {
        // Use in-memory admin mappings
        const artistMap = adminMappings.find((m) => m.raw === data.artist);
        if (artistMap) data.artist = artistMap.display;
        const albumArtistMap = adminMappings.find((m) => m.raw === data.album_artist);
        if (albumArtistMap) data.album_artist = albumArtistMap.display;

        const albumRecord = adminAlbums.find(
          (a) => a.album_artist === data.album_artist && a.album === data.album
        );
        if (albumRecord) {
          data.genre = albumRecord.genre;
          data.year = albumRecord.year;
          if (albumRecord.art) {
            data.thumbnail_b64 = await blobToBase64(albumRecord.art);
          }
          setAlbumAutofilled(true);
        }
      } else {
        // Use IndexedDB for non-admin users
        const artistDisplay = await lookupArtist(data.artist);
        if (artistDisplay) data.artist = artistDisplay;
        const albumArtistDisplay = await lookupArtist(data.album_artist);
        if (albumArtistDisplay) data.album_artist = albumArtistDisplay;

        const albumRecord = await lookupAlbum(data.album_artist, data.album);
        if (albumRecord) {
          data.genre = albumRecord.genre;
          data.year = albumRecord.year;
          if (albumRecord.art) {
            data.thumbnail_b64 = await blobToBase64(albumRecord.art);
          }
          setAlbumAutofilled(true);
        }
      }

      setMetadata(data);
      setStep('tagging');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setStep('input');
    }
  }

  async function handleSave(tags: ID3Tags) {
    if (!metadata) return;

    if (savedFile && JSON.stringify(savedFile.tags) === JSON.stringify(tags)) {
      triggerDownload(savedFile.blob, savedFile.filename);
      return;
    }

    setSavedFile(null);
    setIsSaving(true);
    setError(null);
    try {
      const filename = [tags.artist, tags.title].filter(Boolean).join(' - ') || metadata.title || 'download';
      const blob = await saveWithTags(metadata.file_id, tags, filename);
      const fullFilename = filename + '.mp3';
      setSavedFile({ blob, filename: fullFilename, tags });
      triggerDownload(blob, fullFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    if (metadata) cancelDownload(metadata.file_id);
    setStep('input');
    setMetadata(null);
    setError(null);
    setIsSaving(false);
    setAlbumAutofilled(false);
    setSavedFile(null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/6 bg-white/2 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
              <span className="text-brand-400 text-xs font-bold">TF</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold text-sm">TuneForge</span>
              <span className="text-slate-600 text-xs hidden sm:inline">YouTube → MP3</span>
            </div>
          </div>

          {/* Admin indicator — only visible when signed in */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleLogout}
              title="Signed in as admin · Click to sign out"
              className="text-slate-700 hover:text-slate-400 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full">
          {adminConfigError && (
            <div className="max-w-2xl mx-auto mb-0">
              <ErrorAlert message={adminConfigError} onDismiss={() => setAdminConfigError(null)} />
            </div>
          )}

          {error && (
            <div className="max-w-2xl mx-auto mb-0">
              <ErrorAlert message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {step === 'input' && (
            <DownloadForm onSubmit={handleDownload} isLoading={false} />
          )}

          {step === 'downloading' && (
            <LoadingState />
          )}

          {step === 'tagging' && metadata && (
            <TagEditor
              metadata={metadata}
              onSave={handleSave}
              isSaving={isSaving}
              onReset={handleReset}
              albumAutofilled={albumAutofilled}
              isAdmin={isAdmin}
              adminToken={adminToken ?? undefined}
              initialMappings={isAdmin ? adminMappings : undefined}
              initialAlbums={isAdmin ? adminAlbums : undefined}
              onMappingsChange={isAdmin ? setAdminMappings : undefined}
              onAlbumsChange={isAdmin ? setAdminAlbums : undefined}
              aiAvailable={aiAvailable ?? true}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/6 py-6 px-6">
        <div className="flex items-center justify-center relative">
          <p className="text-xs text-slate-600">
            For personal use only. Respect copyright and YouTube's{' '}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-400 underline transition-colors"
            >
              Terms of Service
            </a>
            .
          </p>
          {/* Login trigger — invisible until hovered */}
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              aria-label="Admin login"
              className="absolute right-0 text-slate-900 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
            </button>
          )}
        </div>
      </footer>

      {showLoginModal && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}
