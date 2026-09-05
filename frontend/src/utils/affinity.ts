import { useSyncExternalStore } from "react";

/**
 * Affinity signals: what the listener actually loves (and skips).
 *
 * Event weights: play 1, complete 2, playlist-add 3, follow 4, like 5,
 * skip -2. Scores decay with a ~45-day half-life so taste evolves instead
 * of fossilizing. Persisted under a fresh v1 key, capped in size.
 */

interface ArtistAffinity {
  score: number;
  plays: number;
  completes: number;
  skips: number;
  likes: number;
  follows: number;
  saves: number;
  updatedAt: string;
}

interface TrackAffinity {
  score: number;
  plays: number;
  completes: number;
  skips: number;
  updatedAt: string;
}

interface AffinityState {
  artists: Record<string, ArtistAffinity>;
  tracks: Record<string, TrackAffinity>;
}

const STORAGE_KEY = "mellow-affinity-v1";
const MAX_ARTISTS = 200;
const MAX_TRACKS = 300;
/** Score halves every ~45 days without reinforcement. */
const HALF_LIFE_DAYS = 45;

const WEIGHTS = {
  play: 1,
  complete: 2,
  playlistAdd: 3,
  follow: 4,
  like: 5,
  skip: -2,
} as const;

function blankArtist(): ArtistAffinity {
  return {
    score: 0,
    plays: 0,
    completes: 0,
    skips: 0,
    likes: 0,
    follows: 0,
    saves: 0,
    updatedAt: new Date().toISOString(),
  };
}

function blankTrack(): TrackAffinity {
  return {
    score: 0,
    plays: 0,
    completes: 0,
    skips: 0,
    updatedAt: new Date().toISOString(),
  };
}

function load(): AffinityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { artists: {}, tracks: {} };
    const parsed = JSON.parse(raw) as Partial<AffinityState>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.artists !== "object" ||
      typeof parsed.tracks !== "object"
    ) {
      return { artists: {}, tracks: {} };
    }
    return {
      artists: parsed.artists as Record<string, ArtistAffinity>,
      tracks: parsed.tracks as Record<string, TrackAffinity>,
    };
  } catch {
    return { artists: {}, tracks: {} };
  }
}

const state: AffinityState = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    // Evict the coldest entries past the caps.
    const artists = Object.entries(state.artists);
    if (artists.length > MAX_ARTISTS) {
      artists
        .sort((a, b) => a[1].score - b[1].score)
        .slice(0, artists.length - MAX_ARTISTS)
        .forEach(([name]) => {
          delete state.artists[name];
        });
    }
    const tracks = Object.entries(state.tracks);
    if (tracks.length > MAX_TRACKS) {
      tracks
        .sort((a, b) => a[1].score - b[1].score)
        .slice(0, tracks.length - MAX_TRACKS)
        .forEach(([key]) => {
          delete state.tracks[key];
        });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort persistence.
  }
  emit();
}

function decayed(score: number, updatedAt: string): number {
  const then = new Date(updatedAt).getTime();
  if (!Number.isFinite(then)) return score;
  const days = Math.max(0, (Date.now() - then) / 86400000);
  return score * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

function cleanArtist(name: string): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown artist") return null;
  return trimmed;
}

function trackKey(title: string, artist: string): string | null {
  const t = (title ?? "").trim().toLowerCase();
  const a = (artist ?? "").trim().toLowerCase();
  if (!t) return null;
  return `${t}::${a}`;
}

function bumpArtist(
  name: string,
  field: keyof Omit<ArtistAffinity, "score" | "updatedAt">,
  weight: number,
) {
  const clean = cleanArtist(name);
  if (!clean) return;
  const entry = state.artists[clean] ?? blankArtist();
  entry[field] += 1;
  entry.score = Math.max(0, decayed(entry.score, entry.updatedAt) + weight);
  entry.updatedAt = new Date().toISOString();
  state.artists[clean] = entry;
  persist();
}

function bumpTrack(
  title: string,
  artist: string,
  field: keyof Omit<TrackAffinity, "score" | "updatedAt">,
  weight: number,
) {
  const key = trackKey(title, artist);
  if (!key) return;
  const entry = state.tracks[key] ?? blankTrack();
  entry[field] += 1;
  entry.score = Math.max(0, decayed(entry.score, entry.updatedAt) + weight);
  entry.updatedAt = new Date().toISOString();
  state.tracks[key] = entry;
  persist();
}

/* ------------------------- Recording API ------------------------- */

export function recordAffPlay(title: string, artist: string): void {
  bumpArtist(artist, "plays", WEIGHTS.play);
  bumpTrack(title, artist, "plays", WEIGHTS.play);
}

export function recordAffComplete(title: string, artist: string): void {
  bumpArtist(artist, "completes", WEIGHTS.complete);
  bumpTrack(title, artist, "completes", WEIGHTS.complete);
}

export function recordAffSkip(title: string, artist: string): void {
  bumpArtist(artist, "skips", WEIGHTS.skip);
  bumpTrack(title, artist, "skips", WEIGHTS.skip);
}

export function recordAffLike(artist: string, adding: boolean): void {
  bumpArtist(artist, "likes", adding ? WEIGHTS.like : -WEIGHTS.like);
}

export function recordAffFollow(artist: string, adding: boolean): void {
  bumpArtist(artist, "follows", adding ? WEIGHTS.follow : -WEIGHTS.follow);
}

export function recordAffSave(artist: string, adding: boolean): void {
  bumpArtist(artist, "saves", adding ? WEIGHTS.follow : -WEIGHTS.follow);
}

export function recordAffPlaylistAdd(title: string, artist: string): void {
  bumpArtist(artist, "plays", WEIGHTS.playlistAdd);
  bumpTrack(title, artist, "plays", WEIGHTS.playlistAdd);
}

/* --------------------------- Reading API --------------------------- */

/** Current decayed score for an artist (0 when unknown). */
export function artistScore(name: string): number {
  const clean = cleanArtist(name);
  if (!clean) return 0;
  const entry = state.artists[clean];
  return entry ? decayed(entry.score, entry.updatedAt) : 0;
}

/** Top artists by decayed score. */
export function topAffinityArtists(limit = 5): string[] {
  return Object.entries(state.artists)
    .map(([name, entry]) => ({
      name,
      score: decayed(entry.score, entry.updatedAt),
    }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((a) => a.name);
}

/** Titles the listener actively avoids (skips dominate). */
export function avoidedTitles(limit = 40): string[] {
  return Object.entries(state.tracks)
    .filter(([, e]) => e.skips >= 2 && e.skips > e.completes)
    .sort((a, b) => b[1].skips - a[1].skips)
    .slice(0, limit)
    .map(([key]) => key.split("::")[0]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AffinityState {
  return state;
}

/** Reactive access (rarely needed — taste reads are pull-based). */
export function useAffinity(): AffinityState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
