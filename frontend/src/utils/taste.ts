import type { HistoryEntry } from "./history";
import type { UserPlaylist } from "./playlists";

/**
 * Deterministic taste profile built from local listening data.
 * No network, no key — just frequency arithmetic over history (weight 1)
 * and playlist tracks (weight 2, explicit curation counts double).
 */
export interface TasteProfile {
  /** Top artist names, most-listened first (max 5). */
  artists: string[];
  /** Titles the user already knows (excluded from mixes, capped). */
  exclude: string[];
}

const MAX_ARTISTS = 5;
const MAX_EXCLUDE = 60;

function countInto(
  counts: Map<string, number>,
  known: Set<string>,
  artist: string,
  title: string,
  weight: number,
) {
  const a = (artist ?? "").trim();
  const t = (title ?? "").trim();
  if (t) known.add(t.toLowerCase());
  if (!a || a.toLowerCase() === "unknown artist") return;
  counts.set(a, (counts.get(a) ?? 0) + weight);
}

export function buildTaste(
  history: HistoryEntry[],
  playlists: UserPlaylist[],
): TasteProfile {
  const counts = new Map<string, number>();
  const known = new Set<string>();
  for (const entry of history) {
    countInto(counts, known, entry.artist, entry.title, 1);
  }
  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      countInto(counts, known, track.artist, track.title, 2);
    }
  }
  const artists = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ARTISTS)
    .map(([name]) => name);
  return { artists, exclude: [...known].slice(0, MAX_EXCLUDE) };
}

/** Stable signature for mix caching (client + server). */
export function tasteSignature(taste: TasteProfile): string {
  return `${taste.artists.join("|").toLowerCase()}::${taste.exclude.length}`;
}
