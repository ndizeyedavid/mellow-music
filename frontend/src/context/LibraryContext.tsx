import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { usePersistentState } from "../utils/usePersistentState";

interface LibraryContextValue {
  likedSongs: string[];
  followedArtists: string[];
  savedAlbums: string[];
  isSongLiked: (id: string) => boolean;
  isArtistFollowed: (id: string) => boolean;
  isAlbumSaved: (id: string) => boolean;
  toggleLikeSong: (id: string, title?: string) => void;
  toggleFollowArtist: (id: string) => void;
  toggleSaveAlbum: (id: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id)
    ? list.filter((item) => item !== id)
    : [...list, id];
}

/** User library state (likes/follows/saved albums), persisted to localStorage. */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [likedSongs, setLikedSongs] = usePersistentState<string[]>(
    "mellow-liked-songs",
    [],
  );
  const [followedArtists, setFollowedArtists] = usePersistentState<string[]>(
    "mellow-followed-artists",
    [],
  );
  const [savedAlbums, setSavedAlbums] = usePersistentState<string[]>(
    "mellow-saved-albums",
    [],
  );

  const toggleLikeSong = useCallback(
    (id: string, title?: string) => {
      const adding = !likedSongs.includes(id);
      setLikedSongs((prev) => toggleInList(prev, id));
      // Confirm with a top-center toast (View jumps to Liked Songs).
      if (title) {
        if (adding) {
          toast.success(
            (t) => (
              <span className="flex items-center gap-3">
                <span className="font-medium">Added to Liked Songs</span>
                <Link
                  to="/liked"
                  onClick={() => toast.dismiss(t.id)}
                  className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-black transition-transform hover:scale-105"
                >
                  View
                </Link>
              </span>
            ),
            { id: `liked-${id}` },
          );
        } else {
          toast("Removed from Liked Songs", { id: `unliked-${id}` });
        }
      }
    },
    [setLikedSongs, likedSongs],
  );
  const toggleFollowArtist = useCallback(
    (id: string) => setFollowedArtists((prev) => toggleInList(prev, id)),
    [setFollowedArtists],
  );
  const toggleSaveAlbum = useCallback(
    (id: string) => setSavedAlbums((prev) => toggleInList(prev, id)),
    [setSavedAlbums],
  );

  const isSongLiked = useCallback(
    (id: string) => likedSongs.includes(id),
    [likedSongs],
  );
  const isArtistFollowed = useCallback(
    (id: string) => followedArtists.includes(id),
    [followedArtists],
  );
  const isAlbumSaved = useCallback(
    (id: string) => savedAlbums.includes(id),
    [savedAlbums],
  );

  return (
    <LibraryContext.Provider
      value={{
        likedSongs,
        followedArtists,
        savedAlbums,
        isSongLiked,
        isArtistFollowed,
        isAlbumSaved,
        toggleLikeSong,
        toggleFollowArtist,
        toggleSaveAlbum,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used within a LibraryProvider");
  }
  return context;
}
