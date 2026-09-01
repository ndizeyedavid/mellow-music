import { api } from "./client";
import { setBackendOnline } from "./connectivity";
import type { Track } from "../data/types";

/** Lightweight discovery item returned by /api/home and /api/search. */
export interface BackendResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  url: string;
}

/** Full song payload returned by /api/fetch/<songID>. */
export interface BackendSong {
  ID: string;
  SONG_NAME: string;
  YT_ID: string;
  SPOTIFY_ID: string;
  DURATION: number;
  AUDIO_URL: string;
  THUMBNAIL: string;
  EXPIRY: string;
  LYRICS: string;
}

/** Stream endpoint for a prepared song ID. */
export function audioUrl(songId: string): string {
  return `/api/audio/${encodeURIComponent(songId)}`;
}

/** Runs a request, reports reachability to the connectivity store. */
async function guarded<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    const value = await request();
    setBackendOnline(true);
    return value;
  } catch {
    setBackendOnline(false);
    return null;
  }
}

/** Homepage discovery results (cache-first on the backend side). */
export async function getHome(): Promise<BackendResult[] | null> {
  return guarded(async () => {
    const { data } = await api.get<{ results: BackendResult[] }>("/api/home");
    return data.results ?? null;
  });
}

/** Track search results for a query string. */
export async function searchTracks(
  query: string,
  maxResults = 10,
): Promise<BackendResult[] | null> {
  return guarded(async () => {
    const { data } = await api.get<{ results: BackendResult[] }>("/api/search", {
      params: { q: query, max_results: maxResults },
    });
    return data.results ?? null;
  });
}

/** Resolve a name/URL to a backend song ID (may take a few seconds first time). */
export async function prepareSong(input: string): Promise<string | null> {
  return guarded(async () => {
    const { data } = await api.get<{ ID: string }>(
      `/api/prepare/${encodeURIComponent(input)}`,
    );
    return data.ID ?? null;
  });
}

/** Map a backend discovery result into the player's Track shape. */
export function toTrack(result: BackendResult, source: string): Track {
  return {
    id: result.id,
    title: result.title,
    artist: result.artist,
    artistId: result.id,
    album: "",
    albumId: "",
    image: result.thumbnail || "",
    source,
    duration: Number(result.duration) || 0,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
  };
}
