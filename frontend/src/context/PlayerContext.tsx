import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { useAudioPlayer, type UseAudioPlayer } from "../hooks/useAudioPlayer";
import { recordHistoryTrack, useHistory } from "../utils/history";
import {
  recordAffComplete,
  recordAffPlay,
  recordAffSkip,
} from "../utils/affinity";
import { usePlaylists } from "./PlaylistContext";
import { buildTaste } from "../utils/taste";
import type { Track } from "../types";
import {
  fetchSongById,
  fetchToTrack,
  getMix,
  prepareSong,
  resolveDiscoveryItem,
  type ApiDiscoveryItem,
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
  const history = useHistory();
  const { playlists } = usePlaylists();

  // Autoplay continuation: taste-seeded mix appended past the queue end.
  // Returns the grown queue (urgent first track) plus follow-up items,
  // or null to let the player stop cleanly.
  const continueQueueEnd = useCallback(
    async (
      queue: Track[],
    ): Promise<{      tracks: Track[];
      startIndex: number;
      rest: ApiDiscoveryItem[];
    } | null> => {
      const taste = buildTaste(history, playlists);
      if (taste.artists.length === 0) return null;
      const exclude = [...taste.exclude, ...queue.map((t) => t.title)];
      let mix;
      try {
        mix = await getMix(taste.artists, exclude, 10);
      } catch {
        return null;
      }
      const known = new Set(queue.map((t) => t.id));
      const fresh = mix.tracks.filter((t) => !known.has(t.id as string));
      if (fresh.length === 0) return null;
      let first: Track;
      try {
        first = await resolveDiscoveryItem(fresh[0]);
      } catch {
        return null;
      }
      toast.success(`Autoplay — kept going with ${mix.name || "your mix"}`, {
        id: `autoplay-${mix.mix_id || Date.now()}`,
      });
      return {
        tracks: [...queue, first],
        startIndex: queue.length,
        rest: fresh.slice(1),
      };
    },
    [history, playlists],
  );

  // Player signal handlers: completions and skips feed affinity.
  const handleTrackEnded = useCallback((track: Track) => {
    if (track.source) recordAffComplete(track.title, track.artist);
  }, []);
  const handleTrackSkipped = useCallback((track: Track) => {
    if (track.source) recordAffSkip(track.title, track.artist);
  }, []);

  const player = useAudioPlayer([], 0, {
    refreshTrack,
    onQueueExhausted: continueQueueEnd,
    onTrackEnded: handleTrackEnded,
    onTrackSkipped: handleTrackSkipped,
  });

  // Record every track change (after mount) to Recently Played + affinity.
  const mounted = useRef(false);
  const track = player.currentTrack;
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!track) return;
    recordHistoryTrack(track);
    if (track.source) recordAffPlay(track.title, track.artist);
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
