import { Link } from "react-router-dom";
import { MdPause, MdPlayArrow } from "react-icons/md";
import type { ReactNode } from "react";
import { SafeImage } from "./SafeImage";
import type { Track } from "../data/library";
import { formatTime } from "../utils/format";

interface SongRowProps {
  song: Track;
  index: number;
  isCurrent?: boolean;
  isPlaying?: boolean;
  onPlay: () => void;
  showAlbum?: boolean;
  showPopularity?: boolean;
  actions?: ReactNode;
}

/** Spotify-style track row: play state, title/artist, album, duration, popularity. */
export function SongRow({
  song,
  index,
  isCurrent = false,
  isPlaying = false,
  onPlay,
  showAlbum = true,
  showPopularity = false,
  actions,
}: SongRowProps) {
  return (
    <li
      aria-current={isCurrent ? "true" : undefined}
      className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        showAlbum || showPopularity
          ? "md:grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4rem]"
          : ""
      } ${isCurrent ? "bg-white/5" : "hover:bg-white/5"}`}
    >
      {/* Index / play */}
      <span className="flex w-10 justify-center">
        {isCurrent ? (
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onPlay}
            className="cursor-pointer text-accent"
          >
            {isPlaying ? <MdPause size={18} /> : <MdPlayArrow size={18} />}
          </button>
        ) : (
          <>
            <span className="text-[14px] tabular-nums text-subtle group-hover:hidden">
              {index + 1}
            </span>
            <button
              type="button"
              aria-label={`Play ${song.title}`}
              onClick={onPlay}
              className="hidden cursor-pointer text-fg hover:text-accent group-hover:block"
            >
              <MdPlayArrow size={18} />
            </button>
          </>
        )}
      </span>

      {/* Title + artist */}
      <div className="flex min-w-0 items-center gap-3">
        <SafeImage
          src={song.image}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0">
          <Link
            to={`/song/${song.id}`}
            className={`block truncate text-[14px]/[20px] font-semibold transition-colors hover:text-accent ${
              isCurrent ? "text-accent" : "text-fg"
            }`}
          >
            {song.title}
          </Link>
          <Link
            to={`/artist/${song.artistId}`}
            className="block truncate text-[12px]/[16px] text-subtle transition-colors hover:text-fg"
          >
            {song.artist}
          </Link>
        </div>
      </div>

      {/* Album */}
      {(showAlbum || showPopularity) && (
        <Link
          to={`/album/${song.albumId}`}
          className="hidden truncate text-[13px]/[18px] text-subtle transition-colors hover:text-fg md:block"
        >
          {song.album}
        </Link>
      )}

      {/* Popularity */}
      {showPopularity && (
        <span
          className="hidden h-1 rounded-full bg-progress md:block"
          title={`Popularity ${song.popularity}`}
          aria-label={`Popularity ${song.popularity}`}
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${song.popularity}%` }}
          />
        </span>
      )}

      {/* Duration */}
      <span className="text-right text-[13px] tabular-nums text-subtle">
        {formatTime(song.duration)}
      </span>

      {/* Optional row actions */}
      {actions}
    </li>
  );
}
