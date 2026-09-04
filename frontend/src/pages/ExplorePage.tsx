import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import { ApiTrackList } from "../components/ApiTrackList";
import { ApiPlaylistCard } from "../components/ApiCards";
import { SafeImage } from "../components/SafeImage";
import { usePlayer } from "../context/PlayerContext";
import {
  getCharts,
  getGenres,
  searchApi,
  type ApiDiscoveryItem,
  type ApiGenre,
  type ApiPlaylist,
} from "../api/music";

/** Mood shortcuts — labels only; results come from live search. */
const MOODS: Array<{ label: string; query: string; gradient: string }> = [
  { label: "Workout", query: "workout hits", gradient: "from-orange-500 to-red-600" },
  { label: "Chill", query: "chill vibes", gradient: "from-sky-500 to-indigo-600" },
  { label: "Party", query: "party anthems", gradient: "from-fuchsia-500 to-purple-700" },
  { label: "Focus", query: "deep focus", gradient: "from-emerald-500 to-teal-700" },
  { label: "Romance", query: "love songs", gradient: "from-rose-500 to-pink-700" },
  { label: "Sleep", query: "sleep sounds", gradient: "from-slate-500 to-slate-800" },
];

/**
 * Explore: moods, an interactive genre explorer and curated playlist
 * spotlights. Discovery-led, unlike Home's chart sliders.
 */
export function ExplorePage() {
  useDocumentTitle("Explore");
  const [genres, setGenres] = useState<ApiGenre[]>([]);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Genres + curated playlists in parallel (runs once on mount).
  useEffect(() => {
    let cancelled = false;
    Promise.all([getGenres(), getCharts(10)])
      .then(([genreData, charts]) => {
        if (cancelled) return;
        setGenres(genreData);
        setPlaylists(charts.playlists);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load explore.");
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
      <h1 className="text-2xl/[32px] font-bold text-fg">Explore</h1>
      <p className="mt-1 text-[14px] text-subtle">
        Moods, genres and curated playlists to get lost in.
      </p>

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3" aria-label="Loading explore">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-28 animate-pulse rounded-xl bg-white/5"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-danger/40 bg-elevated p-8 text-center">
          <p className="text-[16px] font-semibold text-fg">
            Couldn&apos;t load explore.
          </p>
          <p className="mt-2 text-[14px] text-subtle">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 cursor-pointer rounded-full bg-fg px-6 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Moods */}
          <section className="mt-8" aria-label="Moods">
            <h2 className="text-[18px]/[24px] font-semibold text-fg">
              Mood
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              {MOODS.map((mood) => (
                <Link
                  key={mood.label}
                  to={`/search?q=${encodeURIComponent(mood.query)}`}
                  className={`relative h-28 overflow-hidden rounded-xl bg-gradient-to-br transition-transform hover:scale-[1.02] ${mood.gradient}`}
                >
                  <span className="absolute left-4 top-4 text-[18px]/[24px] font-bold text-white drop-shadow">
                    {mood.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-4 -right-4 h-24 w-24 rotate-[25deg] rounded-lg bg-black/25"
                  />
                </Link>
              ))}
            </div>
          </section>

          {/* Interactive genre explorer */}
          {genres.length > 0 && (
            <GenreExplorer genres={genres} />
          )}

          {/* Curated playlists spotlight */}
          {playlists.length > 0 && (
            <section className="mt-10" aria-label="Curated playlists">
              <h2 className="text-[18px]/[24px] font-semibold text-fg">
                Curated for you
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Genre explorer: pick a genre, hear it instantly                     */
/* ------------------------------------------------------------------ */

function GenreExplorer({ genres }: { genres: ApiGenre[] }) {
  const [selectedId, setSelectedId] = useState<string>(genres[0]?.id ?? "");
  const selected = genres.find((g) => g.id === selectedId) ?? genres[0];

  if (!selected) return null;

  return (
    <section className="mt-10" aria-label="Explore by genre">
      <h2 className="text-[18px]/[24px] font-semibold text-fg">
        Explore by genre
      </h2>
      <p className="mt-1 text-[13px] text-subtle">
        Pick a genre to hear its top tracks instantly.
      </p>
      <div className="mt-4 flex flex-wrap gap-4" role="tablist" aria-label="Genres">
        {genres.slice(0, 12).map((genre) => {
          const active = genre.id === selected.id;
          return (
            <button
              key={genre.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedId(genre.id)}
              className={`relative h-24 w-40 shrink-0 overflow-hidden rounded-lg transition-all hover:scale-[1.02] ${
                active
                  ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                  : ""
              }`}
            >
              <SafeImage
                src={genre.picture}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-70"
                loading="lazy"
              />
              <span className="absolute left-3 top-3 text-[14px]/[18px] font-bold text-fg drop-shadow">
                {genre.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Genre tracks (keyed: fresh load per genre, no setState-in-effect) */}
      <div className="mt-4">
        <GenreTracks key={selected.id} genre={selected} />
      </div>
    </section>
  );
}

function GenreTracks({ genre }: { genre: ApiGenre }) {
  const [tracks, setTracks] = useState<ApiDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTrack, isPlaying } = usePlayer();
  const { playItems, isResolving, resolvingKey } = usePlayDiscovery();

  useEffect(() => {
    let cancelled = false;
    searchApi(genre.name, 12)
      .then((results) => {
        if (!cancelled) setTracks(results);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [genre.name]);

  if (loading) {
    return (
      <div className="space-y-3" aria-label={`Loading ${genre.name}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} aria-hidden="true" className="flex items-center gap-3 p-3">
            <div className="h-10 w-10 animate-pulse rounded-md bg-white/5" />
            <div className="flex-1">
              <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
              <div className="mt-1.5 h-3 w-1/4 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <p className="text-[14px] text-subtle">
        Nothing found for {genre.name} right now.
      </p>
    );
  }

  return (
    <>
      <p className="text-[13px] text-subtle">
        Top {genre.name} tracks — tap play on any row.
      </p>
      <ApiTrackList
        items={tracks}
        currentTitle={currentTrack?.title}
        isPlaying={isPlaying}
        onPlay={(i) => void playItems(tracks, i)}
        isResolvingItem={isResolving}
        resolvingActive={resolvingKey !== null}
        enableAdd
      />
    </>
  );
}
