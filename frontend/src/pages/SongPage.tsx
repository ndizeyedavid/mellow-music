import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MdFavorite, MdFavoriteBorder, MdPlayArrow } from "react-icons/md";
import { SafeImage } from "../components/SafeImage";
import { AddTrackButton } from "../components/AddToPlaylist";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import {
  fetchSongById,
  fetchToTrack,
  prepareSong,
  searchApi,
  type ApiDiscoveryItem,
  type ApiFetchSong,
} from "../api/music";
import type { Track } from "../types";
import { formatTime } from "../utils/format";

const NO_LYRICS = "No Lyrics LOL :)";

/**
 * Song detail, resolved live via prepare -> fetch.
 * Route param is the URL-encoded track title.
 */
export function SongPage() {
  const { id = "" } = useParams();
  const title = id.trim();
  // Keyed so a fresh loading state starts per song (no setState-in-effect).
  return <SongDetail key={title} title={title} />;
}

function SongDetail({ title }: { title: string }) {
  useDocumentTitle(title || "Song");

  const [song, setSong] = useState<ApiFetchSong | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [related, setRelated] = useState<ApiDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    title ? null : "No song specified.",
  );

  const { currentTrack, isPlaying, replaceQueue, togglePlay } = usePlayer();
  const { isSongLiked, toggleLikeSong } = useLibrary();
  const { playItems, isResolving, resolvingKey } = usePlayDiscovery();

  useEffect(() => {
    if (!title) return;
    let cancelled = false;
    (async () => {
      const songId = await prepareSong(title);
      const fetched = await fetchSongById(songId);
      if (cancelled) return;
      setSong(fetched);
      setTrack(fetchToTrack(fetched));
      // More from the same artist (best-effort, never blocks the page).
      const artist = (fetched.SONG_NAME.split(" - ")[0] ?? "").trim();
      if (artist) {
        try {
          const results = await searchApi(artist, 6);
          if (!cancelled) {
            setRelated(
              results.filter(
                (r) =>
                  r.title?.trim().toLowerCase() !==
                  fetched.SONG_NAME.trim().toLowerCase(),
              ),
            );
          }
        } catch {
          // Related is optional.
        }
      }
    })()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load song.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [title]);

  if (loading && !error) {
    return (
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="h-44 w-44 animate-pulse rounded-lg bg-white/5 md:h-56 md:w-56" />
          <div className="min-w-0 flex-1">
            <div className="h-10 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !song || !track) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Song not found</p>
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

  const isCurrent = currentTrack?.id === track.id;
  const liked = isSongLiked(track.id);
  const lyrics =
    song.LYRICS && song.LYRICS !== NO_LYRICS
      ? song.LYRICS.split("\n").filter((line) => line.trim())
      : [];

  return (
    <div className="px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <SafeImage
          src={track.image}
          alt={track.title}
          className="h-44 w-44 rounded-lg object-cover shadow-xl-dark md:h-56 md:w-56"
        />
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Song
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {track.title}
          </h1>
          <p className="mt-3 text-[14px]/[20px] text-subtle">
            <Link
              to={`/search?q=${encodeURIComponent(track.artist)}`}
              className="font-semibold text-fg hover:text-accent"
            >
              {track.artist}
            </Link>{" "}
            • {formatTime(track.duration)}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                isCurrent ? togglePlay() : replaceQueue([track], 0)
              }
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-fg text-[#171719] shadow-md-dark transition-transform hover:scale-105"
              aria-label={isCurrent && isPlaying ? "Pause" : "Play"}
            >
              <MdPlayArrow size={24} />
            </button>
            <button
              type="button"
              aria-label={liked ? "Remove from liked" : "Add to liked"}
              aria-pressed={liked}
              onClick={() => toggleLikeSong(track.id, track.title)}
              className={`cursor-pointer transition-transform hover:scale-110 ${
                liked ? "text-accent" : "text-fg hover:text-accent"
              }`}
            >
              {liked ? (
                <MdFavorite size={26} />
              ) : (
                <MdFavoriteBorder size={26} />
              )}
            </button>
            <AddTrackButton track={track} />
          </div>
        </div>
      </div>

      {/* Lyrics */}
      <section className="mt-8 max-w-2xl">
        <h2 className="text-[18px]/[24px] font-semibold text-fg">Lyrics</h2>
        <div className="mt-3 rounded-2xl border border-border bg-elevated p-6">
          {lyrics.length === 0 ? (
            <p className="text-[15px]/[24px] text-subtle">
              Lyrics aren&apos;t available for this track yet.
            </p>
          ) : (
            lyrics.map((line, index) => (
              <p
                key={index}
                className={`py-0.5 text-[15px]/[24px] ${
                  isCurrent ? "text-fg" : "text-fg/70"
                }`}
              >
                {line}
              </p>
            ))
          )}
        </div>
      </section>

      {/* More like this */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">
            More like this
          </h2>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {related.map((item, index) => {
              const itemTitle = item.title?.trim() || "Unknown title";
              const resolving = isResolving(item, index);
              return (
                <li
                  key={`${item.id}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-elevated p-3 transition-colors hover:bg-white/5"
                >
                  <SafeImage
                    src={item.thumbnail ?? ""}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/song/${encodeURIComponent(itemTitle)}`}
                      className="block truncate text-[14px]/[20px] font-semibold text-fg hover:text-accent"
                    >
                      {itemTitle}
                    </Link>
                    <p className="truncate text-[12px]/[16px] text-subtle">
                      {item.artist?.trim() || "Unknown artist"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void playItems(related, index)}
                    disabled={resolvingKey !== null}
                    aria-label={
                      resolving ? `Loading ${itemTitle}` : `Play ${itemTitle}`
                    }
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fg text-[#171719] transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-60"
                  >
                    {resolving ? (
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-[#171719]/20 border-t-[#171719]"
                        role="status"
                        aria-label="Loading"
                      />
                    ) : (
                      <MdPlayArrow size={20} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
