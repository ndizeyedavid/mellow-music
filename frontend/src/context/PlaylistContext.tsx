import { createContext, useCallback, useContext, type ReactNode } from "react";
import { usePersistentState } from "../utils/usePersistentState";
import type {
  NewSavedTrack,
  UserPlaylist,
} from "../utils/playlists";

/**
 * User playlists v2 — snapshot model for dynamic tracks.
 * Stored under a fresh key: old mock-seeded playlists are abandoned.
 */

interface PlaylistContextValue {
  playlists: UserPlaylist[];
  createPlaylist: (values: { name: string; description: string }) => UserPlaylist;
  updatePlaylist: (id: string, patch: Partial<UserPlaylist>) => void;
  removePlaylist: (id: string) => void;
  addTrack: (playlistId: string, track: NewSavedTrack) => boolean;
  removeTrack: (playlistId: string, trackId: string) => void;
  moveTrack: (playlistId: string, from: number, to: number) => void;
  isTrackSaved: (playlistId: string, trackId: string) => boolean;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

/** Shared playlist state: create / update / remove / track ops (persisted). */
export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = usePersistentState<UserPlaylist[]>(
    "mellow-playlists-v2",
    [],
  );

  const createPlaylist = useCallback(
    (values: { name: string; description: string }): UserPlaylist => {
      const playlist: UserPlaylist = {
        id: `pl-${Date.now()}`,
        name: values.name.trim() || "Untitled playlist",
        description: values.description.trim(),
        owner: "You",
        createdAt: new Date().toISOString(),
        tracks: [],
      };
      setPlaylists((prev) => [playlist, ...prev]);
      return playlist;
    },
    [setPlaylists],
  );

  const updatePlaylist = useCallback(
    (id: string, patch: Partial<UserPlaylist>) => {
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === id ? { ...playlist, ...patch } : playlist,
        ),
      );
    },
    [setPlaylists],
  );

  const removePlaylist = useCallback(
    (id: string) => {
      setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));
    },
    [setPlaylists],
  );

  /** Add a snapshot; false when already present (no duplicates). */
  const addTrack = useCallback(
    (playlistId: string, track: NewSavedTrack): boolean => {
      let added = false;
      setPlaylists((prev) =>
        prev.map((playlist) => {
          if (playlist.id !== playlistId) return playlist;
          if (
            playlist.tracks.some(
              (t) =>
                t.trackId === track.trackId ||
                (t.title === track.title && t.artist === track.artist),
            )
          ) {
            return playlist;
          }
          added = true;
          return { ...playlist, tracks: [...playlist.tracks, track] };
        }),
      );
      return added;
    },
    [setPlaylists],
  );

  const removeTrack = useCallback(
    (playlistId: string, trackId: string) => {
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                tracks: playlist.tracks.filter((t) => t.trackId !== trackId),
              }
            : playlist,
        ),
      );
    },
    [setPlaylists],
  );

  const moveTrack = useCallback(
    (playlistId: string, from: number, to: number) => {
      if (from === to) return;
      setPlaylists((prev) =>
        prev.map((playlist) => {
          if (playlist.id !== playlistId) return playlist;
          if (from < 0 || from >= playlist.tracks.length) return playlist;
          if (to < 0 || to >= playlist.tracks.length) return playlist;
          const next = [...playlist.tracks];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return { ...playlist, tracks: next };
        }),
      );
    },
    [setPlaylists],
  );

  const isTrackSaved = useCallback(
    (playlistId: string, trackId: string): boolean =>
      playlists.some(
        (playlist) =>
          playlist.id === playlistId &&
          playlist.tracks.some((t) => t.trackId === trackId),
      ),
    [playlists],
  );

  return (
    <PlaylistContext.Provider
      value={{
        playlists,
        createPlaylist,
        updatePlaylist,
        removePlaylist,
        addTrack,
        removeTrack,
        moveTrack,
        isTrackSaved,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlaylists(): PlaylistContextValue {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error("usePlaylists must be used within a PlaylistProvider");
  }
  return context;
}
