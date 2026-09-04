/**
 * User playlist model (v2). Snapshot-based: each saved track stores its
 * playable AUDIO_URL as-is plus expiry metadata. Playback uses the snapshot
 * when fresh, otherwise re-resolves via prepare -> fetch.
 */

/** Fetch ID when known (stable via DB aliases); may be a legacy id. */
export interface SavedTrack {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  /** Ambient backdrop (YouTube thumb); falls back to thumbnail. */
  backdrop: string | null;
  duration: number;
  audioUrl: string;
  /** ISO expiry of audioUrl; null = never expires. */
  expiresAt: string | null;
}

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  tracks: SavedTrack[];
}

export interface NewSavedTrack {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  backdrop: string | null;
  duration: number;
  audioUrl: string;
  expiresAt: string | null;
}

/** Cover = first track art, else empty (SafeImage renders a placeholder). */
export function playlistCover(playlist: UserPlaylist): string {
  return playlist.tracks[0]?.thumbnail ?? "";
}
