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
  prepareSong,
  toTrack,
  type BackendResult,
} from "../api/music";
import { isBackendOnline, isNetworkOnline } from "../api/connectivity";

/** Demo audio used as a graceful fallback when the backend is unreachable. */
const DEMO_SRC = "/demo.mp3";

export interface PlayerState extends UseAudioPlayer {
  preparing: boolean;
  playResults: (results: BackendResult[], startIndex?: number) => Promise<void>;
}

const PlayerContext = createContext<PlayerState | null>(null);

/** Provides the shared audio player state to the player bar and side panel. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(playerQueue);
  const { replaceQueue } = player;
  const [preparing, setPreparing] = useState(false);

  /**
   * Play backend discovery results. The clicked track is prepared and starts
   * playing right away; the rest of the queue is prepared in the background
   * and swapped in when ready. Falls back to demo audio when offline.
   */
  const playResults = useCallback(
    async (results: BackendResult[], startIndex = 0) => {
      if (!results.length) return;
      const online = isNetworkOnline() && isBackendOnline();
      const target = Math.max(0, Math.min(startIndex, results.length - 1));
      setPreparing(true);
      try {
        if (!online) {
          replaceQueue(
            results.map((result) => toTrack(result, DEMO_SRC)),
            target,
          );
          return;
        }
        // Prepare the clicked track first so playback starts ASAP.
        const clicked = results[target];
        const clickedId = await prepareSong(
          clicked.url || `${clicked.title} ${clicked.artist}`,
        );
        const initial: Track[] = results.map((result, index) =>
          index === target
            ? toTrack(result, clickedId ? audioUrl(clickedId) : DEMO_SRC)
            : toTrack(result, DEMO_SRC),
        );
        replaceQueue(initial, target);

        // Fill the remaining sources in the background, then swap in place.
        void Promise.allSettled(
          results.map(async (result, index) => {
            if (index === target) return;
            const id = await prepareSong(
              result.url || `${result.title} ${result.artist}`,
            );
            initial[index] = toTrack(result, id ? audioUrl(id) : DEMO_SRC);
          }),
        ).then(() => replaceQueue(initial, target));
      } finally {
        setPreparing(false);
      }
    },
    [replaceQueue],
  );

  return (
    <PlayerContext.Provider value={{ ...player, preparing, playResults }}>
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
