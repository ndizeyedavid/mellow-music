import { useEffect, useMemo, useState } from "react";
import { SectionSlider } from "../components/SectionSlider";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import { useHistory } from "../utils/history";
import { usePlaylists } from "../context/PlaylistContext";
import { buildTaste, tasteSignature } from "../utils/taste";
import {
  ApiArtistCard,
  ApiGenreCard,
  ApiPlaylistCard,
  ApiTrackCard,
} from "../components/ApiCards";
import {
  getCharts,
  getGenres,
  getMix,
  searchPlaylists,
  type ApiCharts,
  type ApiDiscoveryItem,
  type ApiGenre,
  type ApiPlaylist,
  type MixResponse,
  type MixTrack,
} from "../api/music";

function SkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden px-8 py-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 shrink-0">
          <div className="h-[136px] w-[136px] animate-pulse rounded-lg bg-white/5" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

/** Home: live charts + genres, no mock data. */
export function HomePage() {
  useDocumentTitle("Home");
  const {
    playItems,
    isResolving,
    resolvingKey,
    playError,
    clearPlayError,
  } = usePlayDiscovery();

  const [charts, setCharts] = useState<ApiCharts | null>(null);
  const [genres, setGenres] = useState<ApiGenre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const history = useHistory();
  const { playlists } = usePlaylists();
  const taste = useMemo(
    () => buildTaste(history, playlists),
    [history, playlists],
  );
  const tasteExclude = taste.exclude;

  // GET /api/charts + GET /api/genres in parallel (runs once on mount;
  // loading/error already initialised above, so no sync setState here).
  useEffect(() => {
    let cancelled = false;
    Promise.all([getCharts(10), getGenres()])
      .then(([chartsData, genreData]) => {
        if (cancelled) return;
        setCharts(chartsData);
        setGenres(genreData);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load home.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="px-4 pt-6 md:px-6">
        <div className="mt-8 flex flex-col gap-10">
          <section>
            <h2 className="px-8 text-[18px]/[24px] font-semibold text-fg">
              Top Tracks
            </h2>
            <SkeletonRow />
          </section>
          <section>
            <h2 className="px-8 text-[18px]/[24px] font-semibold text-fg">
              New Albums
            </h2>
            <SkeletonRow />
          </section>
        </div>
      </div>
    );
  }

  if (error || !charts) {
    return (
      <div className="px-6 pt-6">
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-danger/40 bg-elevated p-8 text-center">
          <p className="text-[18px] font-semibold text-fg">
            Couldn&apos;t reach the music API.
          </p>
          <p className="mt-2 text-[14px] text-subtle">
            {error ?? "Unknown error."} Make sure the backend is running.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 cursor-pointer rounded-full bg-fg px-6 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 md:px-6">
      <div className="mt-8 flex flex-col gap-10">
        {playError && (
          <div
            role="alert"
            className="mx-2 flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg md:mx-8"
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

        <TasteRow
          onPlay={(items, i) => void playItems(items, i)}
          isResolving={isResolving}
          resolvingActive={resolvingKey !== null}
        />

        {charts.tracks.length > 0 && (
          <SectionSlider title="Top Tracks">
            {charts.tracks.map((item, index) => (
              <ApiTrackCard
                key={`${item.id}-${index}`}
                item={item}
                index={index}
                items={charts.tracks}
                onPlay={(items, i) => void playItems(items, i)}
                resolving={isResolving(item, index)}
                disabled={resolvingKey !== null}
              />
            ))}
          </SectionSlider>
        )}

        <GenreTasteMixes
          genres={genres}
          exclude={tasteExclude}
          onPlay={(items, i) => void playItems(items, i)}
          isResolving={isResolving}
          resolvingActive={resolvingKey !== null}
        />

        {charts.playlists.length > 0 && (
          <SectionSlider title="Popular Playlists">
            {charts.playlists.map((playlist) => (
              <ApiPlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </SectionSlider>
        )}

        <TastePlaylistsRow />

        {genres.length > 0 && (
          <SectionSlider title="Top Genres" gap="gap-4">
            {genres.slice(0, 12).map((genre) => (
              <ApiGenreCard key={genre.id} genre={genre} />
            ))}
          </SectionSlider>
        )}

        {charts.artists.length > 0 && (
          <SectionSlider title="Featured Artists" gap="gap-4">
            {charts.artists.map((artist) => (
              <ApiArtistCard key={artist.id} artist={artist} />
            ))}
          </SectionSlider>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Taste playlists: curated lists matching the listener's top artists */
/* ------------------------------------------------------------------ */

function TastePlaylistsRow() {
  const history = useHistory();
  const { playlists } = usePlaylists();
  const taste = useMemo(
    () => buildTaste(history, playlists),
    [history, playlists],
  );
  if (taste.artists.length === 0) return null;
  return (
    <TastePlaylists key={tasteSignature(taste)} artists={taste.artists} />
  );
}

function TastePlaylists({ artists }: { artists: string[] }) {
  const [items, setItems] = useState<ApiPlaylist[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(artists.slice(0, 2).map((a) => searchPlaylists(a, 4)))
      .then((groups) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: ApiPlaylist[] = [];
        for (const group of groups) {
          for (const playlist of group) {
            if (!seen.has(playlist.id)) {
              seen.add(playlist.id);
              merged.push(playlist);
            }
          }
        }
        setItems(merged.slice(0, 8));
      })
      .catch(() => {
        // Optional row — popular playlists carry the page on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [artists]);

  if (items.length === 0) return null;
  return (
    <SectionSlider title="Playlists for your taste">
      {items.map((playlist) => (
        <ApiPlaylistCard key={playlist.id} playlist={playlist} />
      ))}
    </SectionSlider>
  );
}

/* ------------------------------------------------------------------ */
/* Genre/taste mixes: per-seed mix rows replacing the static album rail */
/* ------------------------------------------------------------------ */

interface MixSeed {
  key: string;
  genres: string[];
}

function GenreTasteMixes({
  genres,
  exclude,
  onPlay,
  isResolving,
  resolvingActive,
}: {
  genres: ApiGenre[];
  exclude: string[];
  onPlay: (items: ApiDiscoveryItem[], index: number) => void;
  isResolving: (item: ApiDiscoveryItem, index: number) => boolean;
  resolvingActive: boolean;
}) {
  // Genre seeds only — the taste row above already covers the listener's
  // top artists, so per-artist rows would just duplicate curator spend.
  const seeds: MixSeed[] = useMemo(() => {
    const seen = new Set<string>();
    const list: MixSeed[] = [];
    for (const genre of genres) {
      const name = (genre.name ?? "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      list.push({ key: `genre:${genre.id}`, genres: [name] });
      if (list.length >= 2) break;
    }
    return list;
  }, [genres]);
  if (seeds.length === 0) return null;
  return (
    <>
      {seeds.map((seed) => (
        <SeedMixRow
          key={seed.key}
          seed={seed}
          exclude={exclude}
          onPlay={onPlay}
          isResolving={isResolving}
          resolvingActive={resolvingActive}
        />
      ))}
    </>
  );
}

function SeedMixRow({
  seed,
  exclude,
  onPlay,
  isResolving,
  resolvingActive,
}: {
  seed: MixSeed;
  exclude: string[];
  onPlay: (items: ApiDiscoveryItem[], index: number) => void;
  isResolving: (item: ApiDiscoveryItem, index: number) => boolean;
  resolvingActive: boolean;
}) {
  const [mix, setMix] = useState<MixResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMix([], exclude, 8, false, seed.genres)
      .then((data) => {
        if (!cancelled && data.tracks.length > 0) setMix(data);
      })
      .catch(() => {
        // Optional row — the page stands without it.
      });
    return () => {
      cancelled = true;
    };
  }, [seed, exclude]);

  if (!mix) return null;
  return (
    <SectionSlider title={mix.name}>
      {mix.tracks.map((item, index) => (
        <ApiTrackCard
          key={`${item.id}-${index}`}
          item={item}
          index={index}
          items={mix.tracks}
          onPlay={onPlay}
          resolving={isResolving(item, index)}
          disabled={resolvingActive}
          note={item.reason || undefined}
        />
      ))}
    </SectionSlider>
  );
}

function TasteRow({
  onPlay,
  isResolving,
  resolvingActive,
}: {
  onPlay: (items: ApiDiscoveryItem[], index: number) => void;
  isResolving: (item: ApiDiscoveryItem, index: number) => boolean;
  resolvingActive: boolean;
}) {
  const history = useHistory();
  const { playlists } = usePlaylists();
  const taste = useMemo(
    () => buildTaste(history, playlists),
    [history, playlists],
  );
  // Cold start (no listening data): charts carry the page, no LLM spend.
  if (taste.artists.length === 0) return null;
  return (
    <TasteMix
      key={tasteSignature(taste)}
      taste={taste}
      onPlay={onPlay}
      isResolving={isResolving}
      resolvingActive={resolvingActive}
    />
  );
}

function TasteMix({
  taste,
  onPlay,
  isResolving,
  resolvingActive,
}: {
  taste: { artists: string[]; exclude: string[] };
  onPlay: (items: ApiDiscoveryItem[], index: number) => void;
  isResolving: (item: ApiDiscoveryItem, index: number) => boolean;
  resolvingActive: boolean;
}) {
  const [tracks, setTracks] = useState<MixTrack[]>([]);
  const [title, setTitle] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMix(taste.artists, taste.exclude, 10)
      .then((mix) => {
        if (cancelled) return;
        setTracks(mix.tracks);
        setTitle(mix.name);
        setReady(true);
      })
      .catch(() => {
        // Taste row is optional — charts carry the page on failure.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [taste]);

  if (!ready || tracks.length === 0) {
    return null;
  }
  return (
    <SectionSlider title={title || "For your taste"}>
      {tracks.map((item, index) => (
        <ApiTrackCard
          key={`${item.id}-${index}`}
          item={item}
          index={index}
          items={tracks}
          onPlay={onPlay}
          resolving={isResolving(item, index)}
          disabled={resolvingActive}
          note={item.reason || undefined}
        />
      ))}
    </SectionSlider>
  );
}
