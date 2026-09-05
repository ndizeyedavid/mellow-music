import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MdFavorite, MdPlayArrow } from "react-icons/md";
import { EmptyState } from "../components/EmptyState";
import { SafeImage } from "../components/SafeImage";
import { AddTrackButton } from "../components/AddToPlaylist";
import { QueueMenuButton } from "../components/QueueMenu";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchSongById, fetchToTrack } from "../api/music";
import type { Track } from "../types";
import { formatTime } from "../utils/format";

/**
 * Liked Songs — automatic playlist built from your likes.
 * Each liked ID resolves live via fetch (client-cached); IDs that no
 * longer resolve are skipped.
 */
export function LikedPage() {
  useDocumentTitle("Liked Songs");
  const { likedSongs, toggleLikeSong } = useLibrary();
  const { currentTrack, replaceQueue } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Empty likes resolve instantly through the same path (no sync sets).
    Promise.allSettled(likedSongs.map((id) => fetchSongById(id)))
      .then((settled) => {
        if (cancelled) return;
        setTracks(
          settled.flatMap((r) =>
            r.status === "fulfilled" ? [fetchToTrack(r.value)] : [],
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [likedSongs]);

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <div className="px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <div className="flex h-44 w-44 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-800 shadow-xl-dark md:h-56 md:w-56">
          <MdFavorite size={72} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Playlist • Automatic
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            Liked Songs
          </h1>
          <p className="mt-2 text-[13px]/[18px] text-subtle">
            You • {tracks.length} song{tracks.length === 1 ? "" : "s"} •{" "}
            {formatTime(totalDuration)}
          </p>
        </div>
      </div>

      {likedSongs.length === 0 ? (
        <EmptyState
          title="No liked songs yet"
          description="Tap the heart on anything playing and it will live here."
          action={
            <Link
              to="/"
              className="inline-block rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Discover music
            </Link>
          }
        />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => tracks.length > 0 && replaceQueue(tracks, 0)}
              disabled={tracks.length === 0}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MdPlayArrow size={20} /> Play
            </button>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3" aria-label="Loading liked songs">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} aria-hidden="true" className="flex items-center gap-3 p-3">
                  <div className="h-10 w-10 animate-pulse rounded-md bg-white/5" />
                  <div className="flex-1">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
                    <div className="mt-1.5 h-3 w-1/4 animate-pulse rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-6">
              {tracks.map((song, index) => {
                const isCurrent = currentTrack?.id === song.id;
                return (
                  <li
                    key={song.id}
                    className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_8.5rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      isCurrent ? "bg-white/5" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="flex w-10 justify-center">
                      <span className="text-[14px] tabular-nums text-subtle group-hover:hidden">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Play ${song.title}`}
                        onClick={() => replaceQueue(tracks, index)}
                        className="hidden cursor-pointer text-fg hover:text-accent group-hover:block"
                      >
                        <MdPlayArrow size={18} />
                      </button>
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                      <SafeImage
                        src={song.image}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/song/${encodeURIComponent(song.title)}`}
                          className={`block truncate text-[14px]/[20px] font-semibold transition-colors hover:text-accent ${
                            isCurrent ? "text-accent" : "text-fg"
                          }`}
                        >
                          {song.title}
                        </Link>
                        <p className="block truncate text-[12px]/[16px] text-subtle">
                          {song.artist}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center justify-end gap-0 text-right text-[13px] tabular-nums text-subtle">
                      {formatTime(song.duration)}
                      <button
                        type="button"
                        aria-label={`Unlike ${song.title}`}
                        aria-pressed="true"
                        onClick={() =>
                          toggleLikeSong(song.id, song.title, song.artist)
                        }
                        className="cursor-pointer rounded-full p-2 text-accent transition-all hover:scale-110 active:scale-90"
                      >
                        <MdFavorite size={16} />
                      </button>
                      <AddTrackButton track={song} />
                      <QueueMenuButton
                        label={song.title}
                        preview={{
                          title: song.title,
                          artist: song.artist,
                          thumbnail: song.image,
                          duration: song.duration,
                        }}
                        getTrack={async () => song}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
