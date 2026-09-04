import { useEffect, useState } from "react";
import { ApiArtistCard } from "../components/ApiCards";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { getCharts, type ApiArtist } from "../api/music";

/** Top artists grid, live from charts. */
export function ArtistsPage() {
  useDocumentTitle("Artists");
  const [artists, setArtists] = useState<ApiArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCharts(20)
      .then((charts) => {
        if (!cancelled) setArtists(charts.artists);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load artists.");
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
      <h1 className="text-2xl/[32px] font-bold text-fg">Top Artists</h1>
      <p className="mt-1 text-[14px] text-subtle">
        {loading ? "Loading…" : `${artists.length} charting artists`}
      </p>
      {error && <p className="mt-6 text-[14px] text-subtle">{error}</p>}
      {loading ? (
        <div className="mt-6 flex flex-wrap gap-4" aria-label="Loading artists">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} aria-hidden="true" className="w-40">
              <div className="mx-auto h-32 w-32 animate-pulse rounded-full bg-white/5" />
              <div className="mx-auto mt-3 h-4 w-3/4 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-4">
          {artists.map((artist) => (
            <ApiArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
}
