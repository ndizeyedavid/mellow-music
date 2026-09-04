import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  getMix,
  resolveDiscoveryItem,
  type ApiDiscoveryItem,
} from "../api/music";
import type { Track } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import { buildTaste } from "../utils/taste";
import { useHistory } from "../utils/history";

/**
 * Anything playable: a discovery item, optionally carrying a snapshot
 * audioUrl (playlists, history). Fresh snapshots play instantly with no
 * network; anything else resolves via prepare -> fetch (cached client-side).
 */
export type ResolvableItem = ApiDiscoveryItem & {
  audioUrl?: string;
  expiresAt?: string | null;
  backdrop?: string | null;
};

/** Tracks resolved ahead of playback in each direction (bounded strain). */
const LOOKAHEAD = 2;

function isFresh(item: ResolvableItem): boolean {
  if (!item.audioUrl) return false;
  if (!item.expiresAt) return true;
  const expiry = new Date(item.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

function snapshotToTrack(item: ResolvableItem, index: number): Track {
  const title = (item.title ?? "").trim() || "Unknown title";
  const artist = (item.artist ?? "").trim() || "Unknown artist";
  return {
    id: item.id ?? `${title}-${index}`,
    title,
    artist,
    artistId: `api-artist-${artist}`,
    album: "Mellow Discovery",
    albumId: "api-discovery",
    image: item.thumbnail ?? "",
    source: item.audioUrl ?? "",
    duration: typeof item.duration === "number" ? item.duration : 0,
    expiresAt: item.expiresAt ?? null,
    backdrop: item.backdrop ?? null,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "Discovery",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
  };
}

async function toPlayableTrack(
  item: ResolvableItem,
  index: number,
): Promise<Track> {
  if (isFresh(item)) return snapshotToTrack(item, index);
  const resolved = await resolveDiscoveryItem(item);
  return resolved;
}

interface Session {
  items: ResolvableItem[];
  /** Item indexes currently in the queue, in queue order. */
  queueIdx: number[];
  /** Item index of the currently playing track. */
  currentItem: number;
  /** Resolved tracks by item index. */
  byIndex: Map<number, Track>;
  /** Item indexes that failed (never retried this session). */
  failed: Set<number>;
  run: number;
  /** Directions with an extension already in flight. */
  busy: Set<1 | -1>;
  /** Autoplay already fired for this session. */
  autoplayed: boolean;
  /** Autoplay toast already shown for this session. */
  autoplayNotified: boolean;
}

/**
 * Play buttons for API discovery items (home/search/detail) and saved
 * snapshots (user playlists).
 *
 * Flow per click: prepare(title) -> fetch(ID) -> AUDIO_URL -> replaceQueue.
 * Only the clicked track + a small lookahead window resolve — the rest of
 * the list resolves lazily as playback advances, so one click costs at most
 * a handful of backend hits instead of the whole list.
 * /api/audio is never used — the <audio> element plays AUDIO_URL directly.
 */
export function usePlayDiscovery() {
  const {
    replaceQueue,
    restart,
    currentIndex,
    queue,
    isPlaying,
    autoplay,
    queueEnded,
    halt,
  } = usePlayer();
  const { playlists } = usePlaylists();
  const history = useHistory();
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const runId = useRef(0);
  const sessionRef = useRef<Session | null>(null);

  const keyOf = (item: ResolvableItem, index: number) =>
    `${item.title ?? "unknown"}::${index}`;

  /** Resolve up to LOOKAHEAD unresolved items past the window edge. */
  const extend = useCallback(
    async (session: Session, direction: 1 | -1) => {
      if (session.busy.has(direction) || session.run !== runId.current) return;
      const edge =
        direction === 1 ? Math.max(...session.queueIdx) : Math.min(...session.queueIdx);
      const targets: number[] = [];
      for (
        let i = edge + direction;
        targets.length < LOOKAHEAD &&
        i >= 0 &&
        i < session.items.length;
        i += direction
      ) {
        if (
          !session.byIndex.has(i) &&
          !session.failed.has(i)
        ) {
          targets.push(i);
        }
      }
      if (targets.length === 0) return;
      session.busy.add(direction);
      try {
        const settled = await Promise.allSettled(
          targets.map((i) => toPlayableTrack(session.items[i], i)),
        );
        if (session.run !== runId.current) return;
        settled.forEach((result, k) => {
          const itemIdx = targets[k];
          if (result.status === "fulfilled") {
            session.byIndex.set(itemIdx, result.value);
          } else {
            session.failed.add(itemIdx);
          }
        });
        session.queueIdx = [...session.byIndex.keys()].sort((a, b) => a - b);
        const tracks = session.queueIdx.map(
          (i) => session.byIndex.get(i) as Track,
        );
        const pos = session.queueIdx.indexOf(session.currentItem);
        if (tracks.length > 0 && pos >= 0) {
          replaceQueue(tracks, pos);
        }
      } finally {
        session.busy.delete(direction);
      }
    },
    [replaceQueue],
  );

  // Grow the window as playback advances through the queue.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || session.run !== runId.current) return;
    const currentTrack = queue[currentIndex];
    if (!currentTrack) return;
    // Map the playing track back to its item; anything else means the
    // queue was replaced outside this session (single-track plays).
    let itemIdx = -1;
    for (const [idx, track] of session.byIndex) {
      if (track.id === currentTrack.id) {
        itemIdx = idx;
        break;
      }
    }
    if (itemIdx === -1) {
      sessionRef.current = null;
      return;
    }
    session.currentItem = itemIdx;
    const pos = session.queueIdx.indexOf(itemIdx);
    if (pos !== -1 && pos >= session.queueIdx.length - LOOKAHEAD) {
      void extend(session, 1);
    }
    if (pos !== -1 && pos < LOOKAHEAD) {
      void extend(session, -1);
    }
  }, [currentIndex, queue, extend]);

  // Autoplay: when the queue ends, keep going with mix tracks seeded
  // from the listener's taste instead of stopping.
  useEffect(() => {
    if (queueEnded === 0) return;
    const session = sessionRef.current;
    if (!session || session.run !== runId.current || session.autoplayed) {
      return;
    }
    // Only the session owning the finished track continues; anything else
    // means the queue moved on (or another instance owns it).
    const lastIdx = session.queueIdx[session.queueIdx.length - 1];
    const lastTrack = session.byIndex.get(lastIdx);
    if (!lastTrack || queue[currentIndex]?.id !== lastTrack.id) return;
    if (!autoplay) {
      session.autoplayed = true;
      halt();
      return;
    }
    const taste = buildTaste(history, playlists);
    if (taste.artists.length === 0) {
      session.autoplayed = true;
      halt();
      return;
    }
    session.autoplayed = true;
    const run = session.run;
    const knownTitles = [
      ...session.items.map((i) => (i.title ?? "").trim()),
      ...queue.map((t) => t.title),
    ];
    getMix(taste.artists, [...taste.exclude, ...knownTitles], 10)
      .then((mix) => {
        const live = sessionRef.current;
        if (!live || live.run !== run || live.run !== runId.current) return;
        // User moved on while the mix brewed — never hijack playback.
        if (live.byIndex.get(live.currentItem)?.id !== lastTrack.id) return;
        const known = new Set(
          [...live.byIndex.values()].map((t) => t.id),
        );
        const fresh = mix.tracks.filter((t) => !known.has(t.id as string));
        if (fresh.length === 0) {
          halt();
          return;
        }
        const base = live.items.length;
        live.items = [...live.items, ...fresh];
        const resolveOne = (k: number): Promise<Track | null> =>
          toPlayableTrack(fresh[k], base + k).then(
            (track) => {
              const cur = sessionRef.current;
              if (!cur || cur.run !== run) return null;
              cur.byIndex.set(base + k, track);
              return track;
            },
            () => {
              sessionRef.current?.failed.add(base + k);
              return null;
            },
          );
        const syncQueue = (cur: Session) => {
          cur.queueIdx = [...cur.byIndex.keys()].sort((a, b) => a - b);
          const tracks = cur.queueIdx.map(
            (i) => cur.byIndex.get(i) as Track,
          );
          const pos = cur.queueIdx.indexOf(cur.currentItem);
          if (pos >= 0) replaceQueue(tracks, pos);
        };
        // Start the first fresh track urgently, fill the rest behind it.
        void resolveOne(0).then((first) => {
          const cur = sessionRef.current;
          if (!cur || cur.run !== run) return;
          // User moved on while resolving — never hijack playback.
          if (cur.byIndex.get(cur.currentItem)?.id !== lastTrack.id) return;
          if (!first) {
            halt();
            return;
          }
          cur.currentItem = base;
          syncQueue(cur);
          if (!cur.autoplayNotified) {
            cur.autoplayNotified = true;
            toast.success(
              `Autoplay — kept going with ${mix.name || "your mix"}`,
              { id: `autoplay-${run}` },
            );
          }
          fresh.forEach((_, k) => {
            if (k === 0) return;
            void resolveOne(k).then((track) => {
              const c2 = sessionRef.current;
              if (!track || !c2 || c2.run !== run) return;
              syncQueue(c2);
            });
          });
        });
      })
      .catch(() => {
        const cur = sessionRef.current;
        if (!cur || cur.run !== run) return;
        if (cur.byIndex.get(cur.currentItem)?.id !== lastTrack.id) return;
        halt();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueEnded]);

  const playItems = useCallback(
    async (items: ResolvableItem[], index: number) => {
      const run = ++runId.current;
      const key = keyOf(items[index], index);
      setResolvingKey(key);
      setPlayError(null);
      // Source already on the speakers? An explicit click replays it.
      const playingSrc =
        isPlaying && queue[currentIndex]?.source
          ? queue[currentIndex].source
          : null;
      try {
        // Resolve the clicked track first for instant playback.
        const first = await toPlayableTrack(items[index], index);
        if (run !== runId.current) return;
        replaceQueue([first], 0);
        if (playingSrc !== null && playingSrc === first.source) {
          restart();
        }
        // Open a session; the watcher effect grows the lookahead window.
        sessionRef.current = {
          items,
          queueIdx: [index],
          currentItem: index,
          byIndex: new Map([[index, first]]),
          failed: new Set(),
          run,
          busy: new Set(),
          autoplayed: false,
          autoplayNotified: false,
        };
      } catch (err) {
        if (run === runId.current) {
          setPlayError(
            err instanceof Error ? err.message : "Could not play this track.",
          );
        }
      } finally {
        if (run === runId.current) setResolvingKey(null);
      }
    },
    [replaceQueue, restart, currentIndex, queue, isPlaying],
  );

  const isResolving = useCallback(
    (item: ResolvableItem, index: number) =>
      resolvingKey === keyOf(item, index),
    [resolvingKey],
  );

  const clearPlayError = useCallback(() => setPlayError(null), []);

  return { playItems, isResolving, resolvingKey, playError, clearPlayError };
}
