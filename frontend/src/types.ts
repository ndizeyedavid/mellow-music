/**
 * Shared player model. The queue holds fully-resolved Tracks whose `source`
 * is played directly by the <audio> element.
 */
export interface Track {
  /** Fetch ID for backend-resolved tracks (stable via DB aliases). */
  id: string;
  title: string;
  artist: string; // display name
  artistId: string;
  album: string; // display name
  albumId: string;
  image: string;
  /**
   * Ambient backdrop (usually the YouTube thumbnail) used blurred behind
   * the main artwork in the fullscreen view. Falls back to `image`.
   */
  backdrop?: string | null;
  source: string;
  duration: number;
  popularity: number; // 0-100
  plays: string;
  releaseDate: string;
  genre: string;
  explicit?: boolean;
  lyrics: string[];
  credits: {
    writers: string[];
    producers: string[];
    label: string;
  };
  /**
   * ISO expiry of `source` for backend-resolved streams; null/undefined =
   * never expires (local files, demos). Used for expiry-resume playback.
   */
  expiresAt?: string | null;
}
