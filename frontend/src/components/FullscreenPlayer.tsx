import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MdClose,
  MdFavorite,
  MdFavoriteBorder,
  MdPause,
  MdPlayArrow,
  MdRepeat,
  MdShuffle,
  MdSkipNext,
  MdSkipPrevious,
  MdVolumeUp,
} from "react-icons/md";
import { SafeImage } from "./SafeImage";
import { AddTrackButton } from "./AddToPlaylist";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { formatTime } from "../utils/format";
import type { RepeatMode } from "../hooks/useAudioPlayer";

const repeatLabel: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all",
  one: "Repeat one",
};

/**
 * Spotify-style fullscreen Now Playing overlay.
 * Blurred YouTube thumbnail as the ambient background, Deezer cover
 * as the hero artwork, full transport + like + save controls.
 */
export function FullscreenPlayer({ onClose }: { onClose: () => void }) {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    progress,
    togglePlay,
    next,
    previous,
    seek,
    setVolumeValue,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
  } = usePlayer();
  const { isSongLiked, toggleLikeSong } = useLibrary();

  // Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!currentTrack) return null;
  const liked = isSongLiked(currentTrack.id);
  const background = currentTrack.backdrop || currentTrack.image;
  const effectiveVolume = muted ? 0 : volume;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing ${currentTrack.title}`}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black"
    >
      {/* Ambient background: YouTube thumb, blurred + darkened */}
      {background && (
        <SafeImage
          src={background}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-[8px] brightness-[0.35]"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <p className="text-[11px]/[14px] font-semibold uppercase tracking-[0.2em] text-white/60">
          Now Playing
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit fullscreen"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <MdClose size={24} />
        </button>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 pb-4">
        <SafeImage
          src={currentTrack.image}
          alt={`${currentTrack.title} cover`}
          className="h-[min(46vh,380px)] w-[min(46vh,380px)] shrink-0 rounded-2xl object-cover shadow-2xl"
        />
        <div className="w-full max-w-xl text-center">
          <Link
            to={`/song/${encodeURIComponent(currentTrack.title)}`}
            onClick={onClose}
            className="block truncate text-3xl font-bold text-white transition-colors hover:text-accent md:text-4xl"
          >
            {currentTrack.title}
          </Link>
          <Link
            to={`/search?q=${encodeURIComponent(currentTrack.artist)}`}
            onClick={onClose}
            className="mt-2 block truncate text-[16px]/[22px] font-medium text-white/60 transition-colors hover:text-white"
          >
            {currentTrack.artist}
          </Link>
        </div>

        {/* Seek */}
        <div className="w-full max-w-xl">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Seek"
            className="player-range w-full"
            style={{
              background: `linear-gradient(to right, #fcfcfc ${progress}%, rgba(255,255,255,0.25) ${progress}%)`,
            }}
          />
          <div className="mt-1 flex items-center justify-between text-[12px] tabular-nums text-white/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-6 md:gap-8">
          <button
            type="button"
            aria-label="Shuffle"
            aria-pressed={shuffle}
            onClick={toggleShuffle}
            className={`cursor-pointer transition-colors ${
              shuffle ? "text-accent" : "text-white/70 hover:text-white"
            }`}
          >
            <MdShuffle size={26} />
          </button>
          <button
            type="button"
            aria-label="Previous"
            onClick={previous}
            className="cursor-pointer text-white/80 transition-colors hover:text-white"
          >
            <MdSkipPrevious size={34} />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform hover:scale-105"
          >
            {isBuffering ? (
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-black"
                role="status"
                aria-label="Buffering"
              />
            ) : isPlaying ? (
              <MdPause size={34} />
            ) : (
              <MdPlayArrow size={34} />
            )}
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={next}
            className="cursor-pointer text-white/80 transition-colors hover:text-white"
          >
            <MdSkipNext size={34} />
          </button>
          <button
            type="button"
            aria-label={repeatLabel[repeat]}
            aria-pressed={repeat !== "off"}
            onClick={cycleRepeat}
            className={`relative cursor-pointer transition-colors ${
              repeat !== "off"
                ? "text-accent"
                : "text-white/70 hover:text-white"
            }`}
          >
            <MdRepeat size={26} />
            {repeat === "one" && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-black">
                1
              </span>
            )}
          </button>
        </div>

        {/* Extras */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            aria-label={liked ? "Remove from liked" : "Add to liked"}
            aria-pressed={liked}
            onClick={() =>
              toggleLikeSong(
                currentTrack.id,
                currentTrack.title,
                currentTrack.artist,
              )
            }
            className={`cursor-pointer transition-all hover:scale-110 active:scale-90 ${
              liked ? "text-accent" : "text-white/70 hover:text-white"
            }`}
          >
            {liked ? <MdFavorite size={22} /> : <MdFavoriteBorder size={22} />}
          </button>
          <span className="text-white/70 transition-colors hover:text-white [&>span]:inline-flex">
            <AddTrackButton track={currentTrack} />
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={toggleMute}
              className={`cursor-pointer transition-colors ${
                muted ? "text-accent" : "text-white/70 hover:text-white"
              }`}
            >
              <MdVolumeUp size={22} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={effectiveVolume}
              onChange={(event) => setVolumeValue(Number(event.target.value))}
              aria-label="Volume"
              className="player-range w-24"
              style={{
                background: `linear-gradient(to right, #fcfcfc ${effectiveVolume * 100}%, rgba(255,255,255,0.25) ${effectiveVolume * 100}%)`,
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
