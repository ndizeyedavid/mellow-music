import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MdPlayArrow } from "react-icons/md";
import { EmptyState } from "../components/EmptyState";
import { SafeImage } from "../components/SafeImage";
import { SectionSlider } from "../components/SectionSlider";
import { ApiTrackList } from "../components/ApiTrackList";
import { QueueMenuButton } from "../components/QueueMenu";
import {
  ApiAlbumCard,
  ApiArtistCard,
  ApiGenreCard,
  ApiPlaylistCard,
} from "../components/ApiCards";
import { usePlayer } from "../context/PlayerContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import {
  getCharts,
  getGenres,
  resolveDiscoveryItem,
  searchAlbums,
  searchApi,
  searchArtists,
  searchPlaylists,
  type ApiAlbum,
  type ApiArtist,
  type ApiDiscoveryItem,
  type ApiGenre,
  type ApiPlaylist,
} from "../api/music";
import { providerMeta, useSearchProvider } from "../utils/searchProvider";
import { formatTime } from "../utils/format";

type Tab = "all" | "songs" | "albums" | "artists" | "playlists";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "playlists", label: "Playlists" },
];

/** Live search across songs, albums, artists and playlists. No mock data. */
export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const provider = useSearchProvider() ?? "deezer";
  useDocumentTitle(query ? `Search: ${query}` : "Search");

  // Empty query -> live browse. Keyed results reset tab + fetch per
  // query and engine (no setState-in-effect).
  if (!query) {
    return <BrowseAll />;
  }
  return (
    <SearchResults
      key={`${query}::${provider}`}
      query={query}
      provider={provider}
    />
  );
}

function SearchResults({
  query,
  provider,
}: {
  query: string;
  provider: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  // Album/artist/playlist search is Deezer-powered; other engines get songs.
  const deezerOnly = provider !== "deezer";
  const visibleTabs = deezerOnly
    ? tabs.filter((t) => t.id === "all" || t.id === "songs")
    : tabs;
  const meta = providerMeta(
    provider === "itunes" || provider === "youtube" ? provider : "deezer",
  );

  const { currentTrack, isPlaying } = usePlayer();
  const { playItems, isResolving, resolvingKey, playError, clearPlayError } =
    usePlayDiscovery();

  const [songs, setSongs] = useState<ApiDiscoveryItem[]>([]);
  const [albums, setAlbums] = useState<ApiAlbum[]>([]);
  const [artists, setArtists] = useState<ApiArtist[]>([]);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fullFetched, setFullFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  // Song pages: 10 first, up to SONG_MAX on scroll (backend caps at 20).
  const SONG_FIRST = 10;
  const SONG_MAX = 20;

  // Debounced multi-type search: song engine + (Deezer-only) collections.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const songSearch = searchApi(query, SONG_FIRST, provider).then(
        (songRes) => {
          setSongs(songRes);
        },
      );
      const collectionSearch = deezerOnly
        ? Promise.resolve()
        : Promise.all([
            searchAlbums(query, 10),
            searchArtists(query, 10),
            searchPlaylists(query, 10),
          ]).then(([albumRes, artistRes, playlistRes]) => {
            setAlbums(albumRes);
            setArtists(artistRes);
            setPlaylists(playlistRes);
          });
      Promise.all([songSearch, collectionSearch])
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Search failed.");
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, provider, deezerOnly]);

  // Infinite scroll for songs: fetch the full page when the sentinel shows.
  const hasMoreSongs =
    !loading &&
    !error &&
    !fullFetched &&
    songs.length >= SONG_FIRST &&
    songs.length < SONG_MAX;
  useEffect(() => {
    const sentinel = moreRef.current;
    if (!sentinel || !hasMoreSongs || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoadingMore(true);
          searchApi(query, SONG_MAX, provider)
            .then((full) => {
              setFullFetched(true);
              setSongs((prev) => {
                const seen = new Set(prev.map((s) => s.id));
                return [...prev, ...full.filter((s) => !seen.has(s.id))];
              });
            })
            .catch(() => {
              // Keep what we have; a retry happens on next intersection.
            })
            .finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreSongs, loadingMore, query, provider]);

  const show = (id: Tab) => tab === "all" || tab === id;
  const hasAny =
    songs.length > 0 ||
    albums.length > 0 ||
    artists.length > 0 ||
    playlists.length > 0;

  return (
    <div className="px-6 pt-6">
      <h1 className="text-2xl/[32px] font-bold text-fg">
        Results for “{query}”
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1 text-[12px]/[16px] font-medium text-subtle">
          <img
            src={meta.logo}
            alt=""
            className="h-4 w-4 object-contain invert"
          />
          via {meta.name}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {visibleTabs.map((item) => (
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

      {playError && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg"
        >
          <span>{playError}</span>
          <button
            type="button"
            onClick={clearPlayError}
            aria-label="Dismiss playback error"
            className="cursor-pointer text-subtle hover:text-fg"
          >
            ✕
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-8 space-y-3" aria-label="Searching">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl p-3"
              aria-hidden="true"
            >
              <div className="h-12 w-12 animate-pulse rounded-lg bg-white/5" />
              <div className="flex-1">
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
                <div className="mt-1.5 h-3 w-1/4 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="mt-6 text-[14px] text-subtle">Search failed: {error}</p>
      )}

      {!loading && !error && (
        <>
          {tab === "all" ? (
            <AllResults
              songs={songs}
              albums={albums}
              artists={artists}
              playlists={playlists}
              currentTitle={currentTrack?.title}
              isPlaying={isPlaying}
              onPlaySongs={(items, i) => void playItems(items, i)}
              isResolvingItem={isResolving}
              resolvingActive={resolvingKey !== null}
              onShowAllSongs={() => setTab("songs")}
            />
          ) : (
            <>
              {show("songs") && songs.length > 0 && (
                <section className="mt-6" aria-label="Songs">
                  <h2 className="text-[18px]/[24px] font-semibold text-fg">
                    Songs
                  </h2>
                  <ApiTrackList
                    items={songs}
                    currentTitle={currentTrack?.title}
                    isPlaying={isPlaying}
                    onPlay={(i) => void playItems(songs, i)}
                    isResolvingItem={isResolving}
                    resolvingActive={resolvingKey !== null}
                    enableAdd
                  />
                  {/* Infinite-scroll sentinel */}
                  {(hasMoreSongs || loadingMore) && (
                    <div ref={moreRef} aria-hidden={!hasMoreSongs}>
                      {loadingMore && (
                        <div className="space-y-3 py-2" aria-label="Loading more songs">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              aria-hidden="true"
                              className="flex items-center gap-3 p-3"
                            >
                              <div className="h-10 w-10 animate-pulse rounded-md bg-white/5" />
                              <div className="flex-1">
                                <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
                                <div className="mt-1.5 h-3 w-1/4 animate-pulse rounded bg-white/5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {show("albums") && albums.length > 0 && (
                <section className="mt-8" aria-label="Albums">
                  <h2 className="text-[18px]/[24px] font-semibold text-fg">
                    Albums
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-6">
                    {albums.map((album) => (
                      <ApiAlbumCard key={album.id} album={album} />
                    ))}
                  </div>
                </section>
              )}

              {show("artists") && artists.length > 0 && (
                <section className="mt-8" aria-label="Artists">
                  <h2 className="text-[18px]/[24px] font-semibold text-fg">
                    Artists
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {artists.map((artist) => (
                      <ApiArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                </section>
              )}

              {show("playlists") && playlists.length > 0 && (
                <section className="mt-8" aria-label="Playlists">
                  <h2 className="text-[18px]/[24px] font-semibold text-fg">
                    Playlists
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-6">
                    {playlists.map((playlist) => (
                      <ApiPlaylistCard key={playlist.id} playlist={playlist} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {!hasAny && (
            <EmptyState
              title={`No results for "${query}"`}
              description="Check the spelling or try a different search."
              action={
                <Link
                  to="/"
                  className="inline-block text-[14px] font-semibold text-accent hover:underline"
                >
                  Back to home
                </Link>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* "All" tab: Top Result hero + songs + sliders                        */
/* ------------------------------------------------------------------ */

function AllResults({
  songs,
  albums,
  artists,
  playlists,
  currentTitle,
  isPlaying,
  onPlaySongs,
  isResolvingItem,
  resolvingActive,
  onShowAllSongs,
}: {
  songs: ApiDiscoveryItem[];
  albums: ApiAlbum[];
  artists: ApiArtist[];
  playlists: ApiPlaylist[];
  currentTitle?: string;
  isPlaying: boolean;
  onPlaySongs: (items: ApiDiscoveryItem[], index: number) => void;
  isResolvingItem: (item: ApiDiscoveryItem, index: number) => boolean;
  resolvingActive: boolean;
  onShowAllSongs: () => void;
}) {
  const top = songs[0];
  const topTitle = top?.title?.trim() || "Unknown title";
  const topArtist = top?.artist?.trim() || "Unknown artist";
  const topResolving = top ? isResolvingItem(top, 0) : false;

  return (
    <>
      {songs.length > 0 && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {/* Top result hero */}
          <section aria-label="Top result">
            <h2 className="text-[18px]/[24px] font-semibold text-fg">
              Top result
            </h2>
            <div className="group relative mt-2 overflow-hidden rounded-2xl border border-border bg-elevated p-5 transition-colors hover:bg-white/5">
              <SafeImage
                src={top?.thumbnail ?? ""}
                alt=""
                className="h-24 w-24 rounded-xl object-cover shadow-lg"
              />
              <Link
                to={`/song/${encodeURIComponent(topTitle)}`}
                className="mt-4 block truncate text-2xl font-bold text-fg transition-colors hover:text-accent"
              >
                {topTitle}
              </Link>
              <p className="mt-1 truncate text-[14px]/[20px] text-subtle">
                {topArtist}
                {typeof top?.duration === "number" && (top?.duration ?? 0) > 0
                  ? ` • ${formatTime(top?.duration ?? 0)}`
                  : ""}
              </p>
              <span className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-[11px]/[14px] font-semibold uppercase tracking-wide text-fg">
                Song
              </span>
              <span className="ml-2 inline-flex translate-y-1">
                <QueueMenuButton
                  label={topTitle}
                  preview={{
                    title: topTitle,
                    artist: topArtist,
                    thumbnail: top?.thumbnail ?? "",
                    duration:
                      typeof top?.duration === "number" ? top.duration : 0,
                  }}
                  getTrack={() => resolveDiscoveryItem(songs[0])}
                />
              </span>
              <button
                type="button"
                onClick={() => onPlaySongs(songs, 0)}
                disabled={resolvingActive}
                aria-label={
                  topResolving ? `Loading ${topTitle}` : `Play ${topTitle}`
                }
                className="absolute bottom-5 right-5 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-fg text-[#171719] opacity-0 shadow-md-dark transition-all duration-200 group-hover:opacity-100 hover:scale-105 disabled:cursor-wait disabled:opacity-100"
              >
                {topResolving ? (
                  <span
                    className="h-5 w-5 animate-spin rounded-full border-2 border-[#171719]/20 border-t-[#171719]"
                    role="status"
                    aria-label="Loading"
                  />
                ) : (
                  <MdPlayArrow size={24} />
                )}
              </button>
            </div>
          </section>

          {/* Top songs (all fetched, up to 10) */}
          <section aria-label="Top songs">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px]/[24px] font-semibold text-fg">
                Songs
              </h2>
              <button
                type="button"
                onClick={onShowAllSongs}
                className="cursor-pointer text-[13px]/[18px] font-medium text-subtle transition-colors hover:text-fg"
              >
                Show all
              </button>
            </div>
            <ApiTrackList
              items={songs}
              currentTitle={currentTitle}
              isPlaying={isPlaying}
              onPlay={(i) => onPlaySongs(songs, i)}
              isResolvingItem={isResolvingItem}
              resolvingActive={resolvingActive}
              enableAdd
            />
          </section>
        </div>
      )}

      {albums.length > 0 && (
        <div className="mt-8">
          <SectionSlider title="Albums">
            {albums.slice(0, 8).map((album) => (
              <ApiAlbumCard key={album.id} album={album} />
            ))}
          </SectionSlider>
        </div>
      )}

      {artists.length > 0 && (
        <div className="mt-8">
          <SectionSlider title="Artists" gap="gap-4">
            {artists.slice(0, 8).map((artist) => (
              <ApiArtistCard key={artist.id} artist={artist} />
            ))}
          </SectionSlider>
        </div>
      )}

      {playlists.length > 0 && (
        <div className="mt-8">
          <SectionSlider title="Playlists">
            {playlists.slice(0, 8).map((playlist) => (
              <ApiPlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </SectionSlider>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Empty query: live genres + chart artists                            */
/* ------------------------------------------------------------------ */

function BrowseAll() {
  const [genres, setGenres] = useState<ApiGenre[]>([]);
  const [artists, setArtists] = useState<ApiArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGenres(), getCharts(8)])
      .then(([genreData, charts]) => {
        if (cancelled) return;
        setGenres(genreData);
        setArtists(charts.artists);
      })
      .catch(() => {
        if (!cancelled) {
          setGenres([]);
          setArtists([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-6 pt-6">
      <h1 className="text-2xl/[32px] font-bold text-fg">Browse all</h1>
      {loading ? (
        <div className="mt-6 flex flex-wrap gap-4" aria-label="Loading browse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 w-40 animate-pulse rounded-lg bg-white/5"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <>
          {genres.length > 0 && (
            <section className="mt-6" aria-label="Genres">
              <h2 className="text-[18px]/[24px] font-semibold text-fg">
                Genres
              </h2>
              <div className="mt-4 flex flex-wrap gap-4">
                {genres.slice(0, 12).map((genre) => (
                  <ApiGenreCard key={genre.id} genre={genre} />
                ))}
              </div>
            </section>
          )}
          {artists.length > 0 && (
            <section className="mt-8" aria-label="Artists">
              <h2 className="text-[18px]/[24px] font-semibold text-fg">
                Popular artists
              </h2>
              <div className="mt-4 flex flex-wrap gap-4">
                {artists.slice(0, 8).map((artist) => (
                  <ApiArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </section>
          )}
          {genres.length === 0 && artists.length === 0 && (
            <p className="mt-6 text-[14px] text-subtle">
              Couldn&apos;t load browse content. Check your connection and try
              searching instead.
            </p>
          )}
        </>
      )}
    </div>
  );
}
