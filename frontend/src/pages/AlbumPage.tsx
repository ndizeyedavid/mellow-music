import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MdPlayArrow, MdShuffle } from "react-icons/md";
import { ApiTrackList } from "../components/ApiTrackList";
import { SafeImage } from "../components/SafeImage";
import { usePlayer } from "../context/PlayerContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import { getAlbum, type ApiAlbum, type ApiDiscoveryItem } from "../api/music";
import { formatTime } from "../utils/format";

/** Album detail, live from GET /api/album/{id}. */
export function AlbumPage() {
  const { id = "" } = useParams();
  // Keyed so a fresh loading state starts per album (no setState-in-effect).
  return <AlbumDetail key={id} id={id} />;
}

function AlbumDetail({ id }: { id: string }) {
  const [album, setAlbum] = useState<ApiAlbum | null>(null);
  const [tracks, setTracks] = useState<ApiDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(album?.title);
  const { currentTrack, isPlaying } = usePlayer();
  const { playItems, isResolving, resolvingKey } = usePlayDiscovery();

  useEffect(() => {
    let cancelled = false;
    getAlbum(id)
      .then((data) => {
        if (cancelled) return;
        setAlbum(data.album);
        setTracks(data.tracks);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load album.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="h-44 w-44 animate-pulse rounded-lg bg-white/5 md:h-56 md:w-56" />
          <div className="min-w-0 flex-1">
            <div className="h-9 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Album not found</p>
        <p className="mt-1 text-[13px] text-subtle">{error}</p>
        <Link
          to="/"
          className="mt-3 inline-block text-[14px] font-semibold text-accent hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const totalDuration = tracks.reduce(
    (sum, t) => sum + (typeof t.duration === "number" ? t.duration : 0),
    0,
  );
  const playShuffled = () => {
    const order = tracks
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5);
    if (order.length > 0) void playItems(tracks, order[0]);
  };

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <SafeImage
          src={album.cover}
          alt={album.title}
          className="h-44 w-44 rounded-lg object-cover shadow-xl-dark md:h-56 md:w-56"
        />
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Album
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {album.title}
          </h1>
          <p className="mt-2 text-[13px]/[18px] text-subtle">
            {album.artist_id ? (
              <Link
                to={`/artist/${album.artist_id}`}
                className="font-semibold text-fg hover:text-accent"
              >
                {album.artist}
              </Link>
            ) : (
              <span className="font-semibold text-fg">{album.artist}</span>
            )}{" "}
            {album.release_date ? `• ${album.release_date.slice(0, 4)} ` : ""}
            • {tracks.length} songs • {formatTime(totalDuration)}
          </p>
          {album.label && (
            <p className="mt-1 text-[12px]/[16px] text-subtle">{album.label}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => tracks.length > 0 && void playItems(tracks, 0)}
          disabled={tracks.length === 0 || resolvingKey !== null}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MdPlayArrow size={20} /> Play
        </button>
        <button
          type="button"
          onClick={playShuffled}
          disabled={tracks.length === 0 || resolvingKey !== null}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-elevated px-5 py-3 text-[14px]/[20px] font-semibold text-fg transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MdShuffle size={18} /> Shuffle
        </button>
      </div>

      <ApiTrackList
        items={tracks}
        currentTitle={currentTrack?.title}
        isPlaying={isPlaying}
        onPlay={(index) => void playItems(tracks, index)}
        isResolvingItem={isResolving}
        resolvingActive={resolvingKey !== null}
        enableAdd
      />
    </div>
  );
}
