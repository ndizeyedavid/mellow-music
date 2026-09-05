import type { HistoryEntry } from "./history";
import type { UserPlaylist } from "./playlists";
import { artistScore, avoidedTitles } from "./affinity";

/**
 * Deterministic taste profile built from local listening data.
 * Frequency over history (weight 1) and playlist tracks (weight 2) is
 * boosted by affinity scores (likes/follows/completes minus skips, with
 * recency decay). Actively avoided tracks are excluded from mixes.
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
  // Blend frequency with affinity: loved artists float up, skipped ones sink.
  const ranked = [...counts.entries()].map(([name, freq]) => ({
    name,
    score: freq + artistScore(name) * 3,
  }));
  const artists = ranked
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ARTISTS)
    .map((a) => a.name);
  const exclude = new Set<string>([...known].slice(0, MAX_EXCLUDE));
  for (const title of avoidedTitles(MAX_EXCLUDE)) {
    if (exclude.size >= MAX_EXCLUDE) break;
    exclude.add(title);
  }
  return { artists, exclude: [...exclude] };
}

/** Stable signature for mix caching (client + server). */
export function tasteSignature(taste: TasteProfile): string {
  return `${taste.artists.join("|").toLowerCase()}::${taste.exclude.length}`;
}
