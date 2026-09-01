import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { playerQueue } from "../data/library";
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
   * Play backend discovery results: prepare each one (name/URL -> song ID),
   * point its source at /api/audio/<ID> and replace the queue.
   * Falls back to demo audio when the network/backend is unreachable.
   */
  const playResults = useCallback(
    async (results: BackendResult[], startIndex = 0) => {
      if (!results.length) return;
      const online = isNetworkOnline() && isBackendOnline();
      setPreparing(true);
      try {
        if (!online) {
          replaceQueue(
            results.map((result) => toTrack(result, DEMO_SRC)),
            startIndex,
          );
          return;
        }
        const prepared = await Promise.all(
          results.map(async (result) => {
            const input = result.url || `${result.title} ${result.artist}`;
            const id = await prepareSong(input);
            return toTrack(result, id ? audioUrl(id) : DEMO_SRC);
          }),
        );
        replaceQueue(prepared, startIndex);
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
