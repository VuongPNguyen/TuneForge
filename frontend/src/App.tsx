import { useState } from 'react';
import { Github } from 'lucide-react';
import DownloadForm from './components/DownloadForm';
import LoadingState from './components/LoadingState';
import TagEditor from './components/TagEditor';
import ErrorAlert from './components/ErrorAlert';
import { downloadVideo, saveWithTags, triggerDownload, cancelDownload } from './api';
import { lookupArtist, lookupAlbum, blobToBase64 } from './db';
import type { AppStep, DownloadMetadata, ID3Tags } from './types';

export default function App() {
  const [step, setStep] = useState<AppStep>('input');
  const [metadata, setMetadata] = useState<DownloadMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [albumAutofilled, setAlbumAutofilled] = useState(false);
  const [savedFile, setSavedFile] = useState<{ blob: Blob; filename: string; tags: ID3Tags } | null>(null);

  async function handleDownload(url: string, bitrate: number) {
    setError(null);
    setStep('downloading');
    setAlbumAutofilled(false);
    try {
      const data = await downloadVideo(url, bitrate);

      // Apply artist name mappings to both artist and album_artist fields
      const artistDisplay = await lookupArtist(data.artist);
      if (artistDisplay) data.artist = artistDisplay;

      const albumArtistDisplay = await lookupArtist(data.album_artist);
      if (albumArtistDisplay) data.album_artist = albumArtistDisplay;

      // Apply album autofill (genre, year, art) if a saved album matches
      const albumRecord = await lookupAlbum(data.album_artist, data.album);
      if (albumRecord) {
        data.genre = albumRecord.genre;
        data.year = albumRecord.year;
        if (albumRecord.art) {
          data.thumbnail_b64 = await blobToBase64(albumRecord.art);
        }
        setAlbumAutofilled(true);
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
              <span className="text-brand-400 text-xs font-bold">M3</span>
            </div>
            <span className="text-white font-semibold text-sm">YT to MP3</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="View on GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full">
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
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/6 py-6 px-6 text-center">
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
      </footer>
    </div>
  );
}
