import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAudioPlayer, type UseAudioPlayer } from "../hooks/useAudioPlayer";
import { recordHistoryTrack } from "../utils/history";
import type { Track } from "../types";
import {
  fetchSongById,
  fetchToTrack,
  prepareSong,
} from "../api/music";

const PlayerContext = createContext<UseAudioPlayer | null>(null);

/** Provides the shared audio player state to the player bar and side panel. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  // Expiry-resume: re-resolve a dead/expired stream and continue mid-song.
  // Fetch IDs are stable (DB aliases), so re-fetch is cheap; anything else
  // falls back to prepare-by-title. Artwork the user already sees is kept.
  const refreshTrack = useCallback(async (track: Track): Promise<Track | null> => {
    const keepArt = (fresh: Track): Track => ({
      ...fresh,
      image: track.image || fresh.image,
      backdrop: track.backdrop ?? fresh.backdrop ?? null,
    });
    try {
      try {
        return keepArt(fetchToTrack(await fetchSongById(track.id)));
      } catch {
        const id = await prepareSong(track.title);
        return keepArt(fetchToTrack(await fetchSongById(id)));
      }
    } catch {
      return null;
    }
  }, []);

  // The queue starts empty — nothing is mocked. First play fills it.
  const player = useAudioPlayer([], 0, { refreshTrack });

  // Record every track change (after mount) to Recently Played.
  const mounted = useRef(false);
  const track = player.currentTrack;
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (track) recordHistoryTrack(track);
  }, [track]);

  return (
    <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer(): UseAudioPlayer {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
