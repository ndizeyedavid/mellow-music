import { createContext, useCallback, useContext, type ReactNode } from "react";
import { playlists as seed, type Playlist } from "../data/library";
import { usePersistentState } from "../utils/usePersistentState";

interface PlaylistContextValue {
  playlists: Playlist[];
  createPlaylist: (values: { name: string; description: string }) => Playlist;
  updatePlaylist: (id: string, patch: Partial<Playlist>) => void;
  removePlaylist: (id: string) => void;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

const defaultImages = [
  "/assets/img/album-mymix-1.png",
  "/assets/img/album-mymix-2.png",
  "/assets/img/album-mymix-3.png",
  "/assets/img/album-mymix-4.png",
  "/assets/img/album-daily-discovery.png",
  "/assets/img/for-you-if-you-wait.png",
];

/** Shared playlist state: create / update / remove across the app (persisted). */
export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = usePersistentState<Playlist[]>(
    "mellow-playlists",
    seed,
  );

  const createPlaylist = useCallback(
    (values: { name: string; description: string }): Playlist => {
      const playlist: Playlist = {
        id: `pl-${Date.now()}`,
        name: values.name,
        description: values.description,
        image: defaultImages[Math.floor(Math.random() * defaultImages.length)],
        owner: "Gi",
        trackIds: [],
      };
      setPlaylists((prev) => [playlist, ...prev]);
      return playlist;
    },
    [setPlaylists],
  );

  const updatePlaylist = useCallback(
    (id: string, patch: Partial<Playlist>) => {
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

  return (
    <PlaylistContext.Provider
      value={{ playlists, createPlaylist, updatePlaylist, removePlaylist }}
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
