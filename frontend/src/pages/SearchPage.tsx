import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SongRow } from "../components/SongRow";
import { AlbumCard } from "../components/AlbumCard";
import { ArtistCard } from "../components/ArtistCard";
import { PlaylistCard } from "../components/PlaylistCard";
import { GenreCard } from "../components/GenreCard";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";
import { usePlayer } from "../context/PlayerContext";
import { useConnectivity } from "../context/ConnectivityContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { searchTracks, toTrack, type BackendResult } from "../api/music";
import { cacheGet, cacheSet } from "../utils/localCache";
import {
  albums,
  artistById,
  artists,
  genres,
  playlists,
  songs,
} from "../data/library";

type Tab = "all" | "songs" | "albums" | "artists" | "playlists";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "playlists", label: "Playlists" },
];

/** Unified search results: live backend songs + local albums/artists/playlists. */
export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const q = query.toLowerCase();
  const [tab, setTab] = useState<Tab>("all");
  useDocumentTitle(query ? `Search: ${query}` : "Search");

  const { currentTrack, isPlaying, playResults } = usePlayer();
  const { networkOnline, backendOnline } = useConnectivity();

  const [remoteSongs, setRemoteSongs] = useState<BackendResult[] | null>(null);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [usingCache, setUsingCache] = useState(false);

  // Live backend search, falling back to the last good cached results.
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    void searchTracks(query, 10).then((results) => {
      if (cancelled) return;
      if (results && results.length) {
        cacheSet(`search:${q}`, results);
        setRemoteSongs(results);
        setUsingCache(false);
      } else {
        const cached = cacheGet<BackendResult[]>(`search:${q}`);
        setRemoteSongs(cached?.length ? cached : null);
        setUsingCache(cached?.length ? true : false);
      }
      setLoadedQuery(query);
    });
    return () => {
      cancelled = true;
    };
  }, [query, q, networkOnline, backendOnline]);

  // Only trust results that belong to the current query.
  const activeRemote = loadedQuery === query ? remoteSongs : null;
  const searchLoading = loadedQuery !== query;
  const activeUsingCache = loadedQuery === query && usingCache;

  const songMatches = useMemo(
    () =>
      songs.filter(
        (song) =>
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q) ||
          song.album.toLowerCase().includes(q),
      ),
    [q],
  );
  const albumMatches = useMemo(
    () =>
      albums.filter(
        (album) =>
          album.title.toLowerCase().includes(q) ||
          artistById(album.artistId)?.name.toLowerCase().includes(q),
      ),
    [q],
  );
  const artistMatches = useMemo(
    () =>
      artists.filter(
        (artist) =>
          artist.name.toLowerCase().includes(q) ||
          artist.bio.toLowerCase().includes(q),
      ),
    [q],
  );
  const playlistMatches = useMemo(
    () =>
      playlists.filter(
        (playlist) =>
          playlist.name.toLowerCase().includes(q) ||
          playlist.description.toLowerCase().includes(q),
      ),
    [q],
  );

  // Backend songs win when present; local catalog is the offline fallback.
  const remoteTracks = useMemo(
    () =>
      activeRemote?.length
        ? activeRemote.map((r) => toTrack(r, "/demo.mp3"))
        : [],
    [activeRemote],
  );
  const songList = remoteTracks.length ? remoteTracks : songMatches;
  const hasSongs = remoteTracks.length > 0 || songMatches.length > 0;

  // Empty query -> browse everything
  if (!query) {
    return (
      <div className="px-6 pt-6">
        <h1 className="text-2xl/[32px] font-bold text-fg">Browse all</h1>
        <div className="mt-6 flex flex-wrap gap-4">
          {genres.map((genre) => (
            <GenreCard key={genre.name} genre={genre} />
          ))}
          {artists.slice(0, 4).map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </div>
    );
  }

  const show = (id: Tab) => tab === "all" || tab === id;

  return (
    <div className="px-6 pt-6">
      <h1 className="text-2xl/[32px] font-bold text-fg">
        Results for “{query}”
      </h1>

      {/* Filter tabs */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px]/[18px] font-semibold transition-colors ${
              tab === item.id
                ? "bg-fg text-[#171719]"
                : "bg-elevated text-fg hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Suggestions + results */}
      {show("songs") && hasSongs && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px]/[24px] font-semibold text-fg">
              Songs ({songList.length})
            </h2>
            {activeUsingCache && (
              <span className="text-[12px]/[16px] font-medium text-subtle">
                Cached results
              </span>
            )}
          </div>
          {searchLoading ? (
            <div className="mt-2">
              <PageLoader />
            </div>
          ) : (
            <ul className="mt-2">
              {songList.slice(0, 10).map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={index}
                  isCurrent={currentTrack.id === song.id}
                  isPlaying={isPlaying}
                  onPlay={() => {
                    if (activeRemote?.length) {
                      void playResults(activeRemote, index);
                    } else {
                      void playResults(
                        songMatches.map((item) => ({
                          id: item.id,
                          title: item.title,
                          artist: item.artist,
                          thumbnail: item.image,
                          duration: item.duration,
                          url: "",
                        })),
                        index,
                      );
                    }
                  }}
                  showPopularity
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {show("albums") && albumMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">
            Albums ({albumMatches.length})
          </h2>
          <div className="mt-4 flex flex-wrap gap-6">
            {albumMatches.slice(0, 8).map((album) => (
              <AlbumCard
                key={album.id}
                to={`/album/${album.id}`}
                image={album.image}
                title={album.title}
                subtitle={artistById(album.artistId)?.name ?? ""}
              />
            ))}
          </div>
        </section>
      )}

      {show("artists") && artistMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">
            Artists ({artistMatches.length})
          </h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {artistMatches.slice(0, 8).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {show("playlists") && playlistMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">
            Playlists ({playlistMatches.length})
          </h2>
          <div className="mt-4 flex flex-wrap gap-6">
            {playlistMatches.slice(0, 8).map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </section>
      )}

      {!hasSongs &&
        albumMatches.length === 0 &&
        artistMatches.length === 0 &&
        playlistMatches.length === 0 && (
          <EmptyState
            title={`No results for "${query}"`}
            description="Check the spelling or try a different search."
            action={
              <Link
                to="/tracks"
                className="inline-block text-[14px] font-semibold text-accent hover:underline"
              >
                Browse all tracks instead
              </Link>
            }
          />
        )}
    </div>
  );
}
