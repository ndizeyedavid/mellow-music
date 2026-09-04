import { useEffect, useState } from "react";
import { ApiAlbumCard } from "../components/ApiCards";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { getCharts, type ApiAlbum } from "../api/music";

/** Top albums grid, live from charts. */
export function AlbumsPage() {
  useDocumentTitle("Albums");
  const [albums, setAlbums] = useState<ApiAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCharts(20)
      .then((charts) => {
        if (!cancelled) setAlbums(charts.albums);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load albums.");
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
      <h1 className="text-2xl/[32px] font-bold text-fg">Top Albums</h1>
      <p className="mt-1 text-[14px] text-subtle">
        {loading ? "Loading…" : `${albums.length} charting albums`}
      </p>
      {error && <p className="mt-6 text-[14px] text-subtle">{error}</p>}
      {loading ? (
        <div className="mt-6 flex flex-wrap gap-6" aria-label="Loading albums">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} aria-hidden="true" className="w-[200px]">
              <div className="h-[176px] w-[176px] animate-pulse rounded-lg bg-white/5" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-6">
          {albums.map((album) => (
            <ApiAlbumCard key={album.id} album={album} />
          ))}
        </div>
      )}
    </div>
  );
}
