export interface DownloadMetadata {
  file_id: string;
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  // Preserved "raw" names before any saved mappings were applied.
  // Used to prefill Artist Name Mappings so the user can map the original channel names.
  original_artist?: string;
  original_album_artist?: string;
  year: string;
  track_number: string;
  genre: string;
  thumbnail_b64: string | null;
  duration: number | null;
  webpage_url: string;
}

export interface ID3Tags {
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: string;
  track_number: string;
  genre: string;
  comment: string;
  album_art_base64: string | null;
}

export type AppStep = 'input' | 'downloading' | 'tagging' | 'saving';
