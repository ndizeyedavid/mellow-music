import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { playerQueue } from "../data/library";
import type { Track } from "../data/types";
import { useAudioPlayer, type UseAudioPlayer } from "../hooks/useAudioPlayer";
import {
  audioUrl,
  prepareInput,
  prepareSong,
  toTrack,
  type BackendResult,
} from "../api/music";
import { isBackendOnline, isNetworkOnline } from "../api/connectivity";

/** Demo audio used as a graceful fallback when the backend is unreachable. */
const DEMO_SRC = "/demo.mp3";

/**
 * Fetch the head of a stream (then release it) so we know it has real data before
 * we hand the <audio> element a URL. The backend keeps buffering in the background,
 * which also warms the stream and makes the later transition feel instant.
 */
async function prefetchStream(
  src: string,
  timeoutMs = 20_000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(src, { signal: controller.signal });
    if (!res.ok || !res.body) return false;
    const reader = res.body.getReader();
    const { done } = await reader.read();
    try {
      void reader.cancel();
    } catch {
      /* ignore */
    }
    return !done;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface PlayerState extends UseAudioPlayer {
  preparing: boolean;
  preparingIds: Record<string, boolean>;
  playResults: (results: BackendResult[], startIndex?: number) => Promise<void>;
}

const PlayerContext = createContext<PlayerState | null>(null);

/** Provides the shared audio player state to the player bar and side panel. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(playerQueue);
  const { replaceQueue } = player;
  const [preparing, setPreparing] = useState(false);
  const [preparingIds, setPreparingIds] = useState<Record<string, boolean>>({});

  /**
   * Play backend discovery results. The clicked track is prepared and its stream
   * is buffered BEFORE we swap playback, so a song you tap (while another is
   * playing) shows a loading spinner on its row instead of cutting the current
   * song off. The rest of the queue is prepared in the background.
   */
  const playResults = useCallback(
    async (results: BackendResult[], startIndex = 0) => {
      if (!results.length) return;
      const online = isNetworkOnline() && isBackendOnline();
      const target = Math.max(0, Math.min(startIndex, results.length - 1));
      const targetTrack = results[target];
      const isCurrent = player.currentTrack?.id === targetTrack.id;
      setPreparing(true);
      try {
        if (!online) {
          replaceQueue(
            results.map((result) => toTrack(result, DEMO_SRC)),
            target,
          );
          return;
        }

        // Build the queue. Others default to demo; the target gets a real source
        // once its stream is confirmed to have streaming data.
        const initial: Track[] = results.map((result) =>
          toTrack(result, DEMO_SRC),
        );

        if (!isCurrent) {
          setPreparingIds((prev) => ({ ...prev, [targetTrack.id]: true }));
        }

        let targetSrc = DEMO_SRC;
        if (isCurrent) {
          // Already loaded: don't restart or show a spinner, just keep it.
          targetSrc = player.currentTrack.source;
        } else {
          const id = await prepareSong(prepareInput(targetTrack));
          if (id) {
            const candidate = audioUrl(id);
            await prefetchStream(candidate); // wait until the stream yields data
            targetSrc = candidate;
          }
        }
        initial[target] = toTrack(targetTrack, targetSrc);
        replaceQueue([...initial], target);

        // Fill the remaining sources in the background with a small concurrency
        // cap so we don't hammer the backend/YouTube with N parallel prepares.
        const cap = 3;
        let next = 0;
        const worker = async () => {
          while (next < results.length) {
            const index = next++;
            if (index === target) continue;
            const id = await prepareSong(prepareInput(results[index]));
            if (id) {
              initial[index] = toTrack(results[index], audioUrl(id));
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(cap, results.length) }, () => worker()),
        );
        replaceQueue([...initial], target);
      } finally {
        setPreparing(false);
        setPreparingIds((prev) => {
          const nextMap = { ...prev };
          delete nextMap[targetTrack.id];
          return nextMap;
        });
      }
    },
    [player.currentTrack, replaceQueue],
  );

  return (
    <PlayerContext.Provider
      value={{ ...player, preparing, preparingIds, playResults }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer(): PlayerState {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
