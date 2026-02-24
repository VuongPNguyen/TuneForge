export interface DownloadMetadata {
  file_id: string;
  title: string;
  artist: string;
  album: string;
  album_artist: string;
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
  album_art_base64: string | null;
}

export type AppStep = 'input' | 'downloading' | 'tagging' | 'saving';
