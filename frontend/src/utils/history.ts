import { useSyncExternalStore } from "react";
import {
  resolveDiscoveryItem,
  type ApiDiscoveryItem,
} from "../api/music";
import type { Track } from "../types";

/**
 * Recently-played history, persisted to localStorage under a fresh v1 key
 * (old mock-seeded storage is intentionally abandoned).
 *
 * Entries keep the playable snapshot (audioUrl as-is) plus enough metadata
 * to re-resolve a fresh URL via prepare -> fetch once it expires.
 */
export interface HistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  /** Ambient backdrop (YouTube thumb); falls back to thumbnail. */
  backdrop: string | null;
  duration: number;
  audioUrl: string;
  /** ISO expiry of audioUrl; null = never expires (local files). */
  expiresAt: string | null;
  /** ISO timestamp of last play. */
  playedAt: string;
}

const STORAGE_KEY = "mellow-history-v1";
const MAX_ENTRIES = 50;
/** Backend audio URLs live ~5h; entries store a snapshot expiry for this. */
const AUDIO_TTL_MS = 5 * 3600 * 1000;

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as HistoryEntry).trackId === "string" &&
        typeof (e as HistoryEntry).title === "string",
    );
  } catch {
    return [];
  }
}

let entries: HistoryEntry[] = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/blocked — history is best-effort.
  }
  emit();
}

/** Record a play: dedup by track, move to front, cap the list. */
export function recordHistoryTrack(track: Track): void {
  if (!track.source) return;
  const now = new Date();
  const entry: HistoryEntry = {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    thumbnail: track.image,
    backdrop: track.backdrop ?? null,
    duration: track.duration,
    audioUrl: track.source,
    expiresAt: track.source.startsWith("http")
      ? new Date(now.getTime() + AUDIO_TTL_MS).toISOString()
      : null,
    playedAt: now.toISOString(),
  };
  entries = [
    entry,
    ...entries.filter((e) => e.trackId !== track.id),
  ].slice(0, MAX_ENTRIES);
  persist();
}

export function clearHistory(): void {
  entries = [];
  persist();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HistoryEntry[] {
  return entries;
}

/** Reactive access to the history list. */
export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Fresh if it has a URL that hasn't expired (or never expires). */
export function isEntryFresh(entry: HistoryEntry): boolean {
  if (!entry.audioUrl) return false;
  if (!entry.expiresAt) return true;
  return new Date(entry.expiresAt).getTime() > Date.now();
}

/** Map an entry back to discovery shape for prepare -> fetch re-resolve. */
export function historyEntryToDiscovery(entry: HistoryEntry): ApiDiscoveryItem {
  return {
    id: entry.trackId,
    title: entry.title,
    artist: entry.artist,
    thumbnail: entry.thumbnail,
    duration: entry.duration,
    url: "",
  };
}

/** Resolve an entry: fresh snapshots play instantly, else re-resolve. */
export async function resolveHistoryEntry(entry: HistoryEntry): Promise<Track> {
  if (isEntryFresh(entry)) return historyEntryToTrack(entry);
  return resolveDiscoveryItem(historyEntryToDiscovery(entry));
}

/** Build a directly-playable Track from a fresh (unexpired) entry. */
export function historyEntryToTrack(entry: HistoryEntry): Track {
  return {
    id: entry.trackId,
    title: entry.title,
    artist: entry.artist,
    artistId: `api-artist-${entry.artist}`,
    album: "Mellow Discovery",
    albumId: "api-discovery",
    image: entry.thumbnail,
    source: entry.audioUrl,
    duration: entry.duration,
    expiresAt: entry.expiresAt,
    backdrop: entry.backdrop ?? null,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "Discovery",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
  };
}
