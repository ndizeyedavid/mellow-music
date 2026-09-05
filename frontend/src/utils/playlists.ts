import {
  resolveDiscoveryItem,
  type ApiDiscoveryItem,
} from "../api/music";
import type { Track } from "../types";
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

/** Build a save-ready snapshot from a fully-resolved Track. */
export function resolvedToSnapshot(track: Track): NewSavedTrack {
  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    thumbnail: track.image,
    backdrop: track.backdrop ?? null,
    duration: track.duration,
    audioUrl: track.source,
    expiresAt: track.expiresAt ?? null,
  };
}

/** Cover = first track art, else empty (SafeImage renders a placeholder). */
export function playlistCover(playlist: UserPlaylist): string {
  return playlist.tracks[0]?.thumbnail ?? "";
}

/** Fresh if it has a URL that hasn't expired (or never expires). */
export function isSavedFresh(track: SavedTrack): boolean {
  if (!track.audioUrl) return false;
  if (!track.expiresAt) return true;
  const expiry = new Date(track.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

/** Map a snapshot back to discovery shape for prepare -> fetch re-resolve. */
export function savedTrackToDiscovery(track: SavedTrack): ApiDiscoveryItem {
  return {
    id: track.trackId,
    title: track.title,
    artist: track.artist,
    thumbnail: track.thumbnail,
    duration: track.duration,
    url: "",
  };
}

/** Build a directly-playable Track from a fresh snapshot. */
export function savedTrackToTrack(track: SavedTrack): Track {
  return {
    id: track.trackId,
    title: track.title,
    artist: track.artist,
    artistId: `api-artist-${track.artist}`,
    album: "Mellow Discovery",
    albumId: "api-discovery",
    image: track.thumbnail,
    source: track.audioUrl,
    duration: track.duration,
    expiresAt: track.expiresAt,
    backdrop: track.backdrop ?? null,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "Discovery",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
  };
}

/** Resolve a snapshot: fresh plays instantly, else re-resolve. */
export async function resolveSavedTrack(track: SavedTrack): Promise<Track> {
  if (isSavedFresh(track)) return savedTrackToTrack(track);
  return resolveDiscoveryItem(savedTrackToDiscovery(track));
}