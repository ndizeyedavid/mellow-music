import { useEffect, useState } from "react";
import { SectionSlider } from "../components/SectionSlider";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import {
  ApiAlbumCard,
  ApiArtistCard,
  ApiGenreCard,
  ApiPlaylistCard,
  ApiTrackCard,
} from "../components/ApiCards";
import {
  getCharts,
  getGenres,
  type ApiCharts,
  type ApiGenre,
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

        {charts.albums.length > 0 && (
          <SectionSlider title="New Albums">
            {charts.albums.map((album) => (
              <ApiAlbumCard key={album.id} album={album} />
            ))}
          </SectionSlider>
        )}

        {charts.playlists.length > 0 && (
          <SectionSlider title="Popular Playlists">
            {charts.playlists.map((playlist) => (
              <ApiPlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </SectionSlider>
        )}

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
