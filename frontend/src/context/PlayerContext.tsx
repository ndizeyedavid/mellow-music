import { createContext, useContext, type ReactNode } from "react";
import { playerQueue } from "../data/library";
import { useAudioPlayer, type UseAudioPlayer } from "../hooks/useAudioPlayer";

const PlayerContext = createContext<UseAudioPlayer | null>(null);

/** Provides the shared audio player state to the player bar and side panel. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(playerQueue);
  return (
    <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer(): UseAudioPlayer {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
