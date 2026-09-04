import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  MdDragHandle,
  MdFavorite,
  MdFavoriteBorder,
  MdMoreHoriz,
  MdOpenInFull,
  MdPause,
  MdPlayArrow,
  MdQueueMusic,
  MdRepeat,
  MdShuffle,
  MdSkipNext,
  MdSkipPrevious,
  MdVolumeUp,
} from "react-icons/md";
import type { RepeatMode } from "../hooks/useAudioPlayer";
import type { Track } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { AddTrackButton } from "./AddToPlaylist";
import { Vinyl } from "./Vinyl";
import { useDragReorder } from "../hooks/useDragReorder";
import { formatTime } from "../utils/format";

/* ---- Small UI helpers ---- */

function ControlButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`cursor-pointer transition-colors ${
        active ? "text-accent" : "text-fg hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

const repeatLabel: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all",
  one: "Repeat one",
};

/** Icon-only button with hover/active feedback (used for cast, queue, more). */
function IconButton({
  label,
  active = false,
  open = false,
  menu = false,
  onClick,
  className = "",
  children,
}: {
  label: string;
  active?: boolean;
  open?: boolean;
  menu?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      aria-haspopup={menu ? "menu" : undefined}
      aria-expanded={open ? true : undefined}
      onClick={onClick}
      className={`cursor-pointer rounded-full p-2 transition-all active:scale-90 ${
        active || open ? "text-accent" : "text-fg hover:text-accent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function MenuItem({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px]/[20px] font-medium transition-colors hover:bg-white/5 ${
        active ? "text-accent" : "text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/** Options dropdown: add to playlist + share + crossfade. */
function OptionsMenu({ track }: { track: Track }) {
  const [copied, setCopied] = useState(false);
  const { crossfade, setCrossfade } = usePlayer();

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div role="menu" aria-label="Track options">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/5">
        <AddTrackButton track={track} />
        <span className="text-[14px]/[20px] font-medium text-fg">
          Add to playlist
        </span>
      </div>
      <MenuItem active={copied} onClick={handleShare}>
        <span className="w-5 text-center">{copied ? "✓" : "↗"}</span>
        {copied ? "Link copied" : "Share"}
      </MenuItem>
      <div className="mt-1 border-t border-border px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px]/[16px] font-semibold text-fg">
            Crossfade
          </span>
          <span className="text-[12px] tabular-nums text-subtle">
            {crossfade === 0 ? "Off" : `${crossfade}s`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={crossfade}
          onChange={(event) => setCrossfade(Number(event.target.value))}
          aria-label="Crossfade seconds"
          className="player-range mt-2 w-full"
          style={{
            background: `linear-gradient(to right, #fcfcfc ${(crossfade / 12) * 100}%, #4c4e54 ${(crossfade / 12) * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}

export function BottomPlayer({
  onExpand,
  onArtwork,
}: {
  onExpand: () => void;
  onArtwork: () => void;
}) {
  const {
    audioRef,
    audioRefB,
    queue,
    currentTrack,
    currentIndex,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    progress,
    streamError,
    togglePlay,
    next,
    previous,
    playFrom,
    seek,
    setVolumeValue,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    moveInQueue,
    clearStreamError,
  } = usePlayer();

  const { isSongLiked, toggleLikeSong } = useLibrary();
  const liked = currentTrack ? isSongLiked(currentTrack.id) : false;

  // Auto-dismiss stream errors after a moment.
  useEffect(() => {
    if (!streamError) return;
    const timer = setTimeout(clearStreamError, 3500);
    return () => clearTimeout(timer);
  }, [streamError, clearStreamError]);

  const [queueOpen, setQueueOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closePopovers = () => {
    setQueueOpen(false);
    setOptionsOpen(false);
    setShortcutsOpen(false);
  };

  const queueDrag = useDragReorder(moveInQueue);

  const effectiveVolume = muted ? 0 : volume;

  // Empty queue (fresh start): slim placeholder that keeps the <audio>
  // elements mounted for the player hook.
  if (!currentTrack) {
    return (
      <footer className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 bg-elevated px-4 py-3.5">
        <audio ref={audioRef} preload="auto" />
        <audio ref={audioRefB} preload="auto" />
        <MdQueueMusic size={20} className="shrink-0 text-subtle" />
        <p className="truncate text-[13px]/[18px] text-subtle">
          Nothing playing — pick a song from Home or Search.
        </p>
      </footer>
    );
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-6 bg-elevated px-4 py-3.5 xl:gap-[112px]">
      <audio ref={audioRef} preload="auto" />
      <audio ref={audioRefB} preload="auto" />

      {/* Stream error toast */}
      {streamError && (
        <div
          role="alert"
          className="absolute bottom-full left-1/2 z-50 mb-3 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-danger/40 bg-elevated px-4 py-2.5 text-[13px]/[18px] font-medium text-fg shadow-xl-dark"
        >
          {streamError}
        </div>
      )}

      {/* Click-away backdrop for popovers */}
      {(queueOpen || optionsOpen || shortcutsOpen) && (
        <div
          aria-hidden="true"
          onClick={closePopovers}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}

      {/* Queue panel (drag rows to reorder) */}
      {queueOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-3 mr-4 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-elevated p-2 shadow-xl-dark">
          <p className="px-3 py-2 text-[10px]/[12px] font-semibold uppercase tracking-wide text-subtle">
            Up next — drag to reorder
          </p>
          {queue.map((track, i) => {
            const isCurrent = i === currentIndex;
            const drag = queueDrag.rowProps(i);
            const isDropTarget =
              queueDrag.dropAt === i && queueDrag.dragFrom !== i;
            const pending = !track.source;
            return (
              <button
                key={`${track.title}-${i}`}
                type="button"
                onClick={() => {
                  if (queueDrag.consumeMoved()) return;
                  playFrom(i);
                  setQueueOpen(false);
                }}
                draggable={drag.draggable}
                onDragStart={drag.onDragStart}
                onDragOver={drag.onDragOver}
                onDragLeave={drag.onDragLeave}
                onDrop={drag.onDrop}
                onDragEnd={drag.onDragEnd}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5 ${
                  isCurrent ? "bg-white/5" : ""
                } ${isDropTarget ? "outline outline-2 outline-accent" : ""} ${
                  queueDrag.dragFrom === i ? "opacity-40" : ""
                } ${pending ? "opacity-70" : ""}`}
              >
                <span
                  className="cursor-grab text-subtle active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <MdDragHandle size={16} />
                </span>
                <span className="relative shrink-0">
                  <img
                    src={track.image}
                    alt=""
                    className="h-10 w-10 rounded-sm object-cover"
                  />
                  {pending && (
                    <span
                      className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/60"
                      role="status"
                      aria-label={`Resolving ${track.title}`}
                    >
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[14px]/[20px] font-semibold ${
                      isCurrent ? "text-accent" : "text-fg"
                    }`}
                  >
                    {track.title}
                  </span>
                  <span className="block truncate text-[12px]/[16px] text-subtle">
                    {track.artist}
                  </span>
                </span>
                {isCurrent && (
                  <span className="shrink-0 text-[10px]/[12px] font-semibold uppercase text-accent">
                    {isPlaying ? "Playing" : "Queued"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Options menu */}
      {optionsOpen && (
        <div className="absolute bottom-full left-[250px] z-50 mb-3 mr-4 w-56 rounded-xl border border-border bg-elevated p-1.5 shadow-xl-dark">
          <OptionsMenu track={currentTrack} />
        </div>
      )}

      {/* Keyboard shortcuts help */}
      {shortcutsOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-3 mr-4 w-64 rounded-xl border border-border bg-elevated p-4 shadow-xl-dark">
          <p className="text-[10px]/[12px] font-semibold uppercase tracking-wide text-subtle">
            Keyboard shortcuts
          </p>
          <ul className="mt-3 space-y-2 text-[13px]/[18px] text-fg">
            <li className="flex items-center justify-between">
              <span>Play / Pause</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 text-[11px]">
                Space
              </kbd>
            </li>
            <li className="flex items-center justify-between">
              <span>Seek ±5s</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 text-[11px]">
                ← →
              </kbd>
            </li>
            <li className="flex items-center justify-between">
              <span>Volume</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 text-[11px]">
                ↑ ↓
              </kbd>
            </li>
          </ul>
        </div>
      )}

      {/* Left: now playing */}
      <div className="flex min-w-0 shrink-0 items-center gap-4">
        <button
          type="button"
          onClick={onArtwork}
          aria-label={`Open artwork for ${currentTrack.title}`}
          title="Open artwork"
          className="cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <Vinyl
            src={currentTrack.image}
            title={currentTrack.title}
            spinning={isPlaying}
            className="h-16 w-16"
          />
        </button>
        <div className="hidden min-w-0 flex-col gap-1.5 sm:flex">
          <div className="flex items-center gap-2">
            <Link
              to={`/song/${encodeURIComponent(currentTrack.title)}`}
              className="max-w-[180px] truncate text-[14px]/[14px] font-semibold tracking-[-0.05em] text-fg transition-colors hover:text-accent"
            >
              {currentTrack.title}
            </Link>
            <ControlButton
              label="Like"
              active={liked}
              onClick={() => toggleLikeSong(currentTrack.id, currentTrack.title)}
            >
              {liked ? (
                <MdFavorite size={16} />
              ) : (
                <MdFavoriteBorder size={16} />
              )}
            </ControlButton>
            <IconButton
              label="More options"
              menu
              open={optionsOpen}
              onClick={() => {
                setOptionsOpen((open) => !open);
                setQueueOpen(false);
                setShortcutsOpen(false);
              }}
            >
              <MdMoreHoriz size={16} />
            </IconButton>
          </div>
          <span className="truncate text-[14px]/[20px] font-semibold tracking-[-0.05em] text-fg/65">
            {currentTrack.artist}
          </span>
          <span className="truncate text-[10px]/[14px] font-semibold uppercase text-fg/65">
            Playing from: {currentTrack.album}
          </span>
        </div>
      </div>

      {/* Center: transport + seek */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-3 px-4 lg:gap-4 lg:px-8">
        <div className="flex items-center gap-4 lg:gap-8">
          <ControlButton
            label="Shuffle"
            active={shuffle}
            onClick={toggleShuffle}
          >
            <MdShuffle size={27} />
          </ControlButton>
          <ControlButton label="Previous" onClick={previous}>
            <MdSkipPrevious size={27} />
          </ControlButton>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-[#171719] shadow-md-dark transition-transform hover:scale-105"
          >
            {isBuffering ? (
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-[#171719]/20 border-t-[#171719]"
                role="status"
                aria-label="Buffering"
              />
            ) : isPlaying ? (
              <MdPause size={27} />
            ) : (
              <MdPlayArrow size={27} />
            )}
          </button>
          <ControlButton label="Next" onClick={next}>
            <MdSkipNext size={27} />
          </ControlButton>
          <ControlButton
            label={repeatLabel[repeat]}
            active={repeat !== "off"}
            onClick={cycleRepeat}
          >
            <MdRepeat size={27} />
          </ControlButton>
        </div>

        <div className="flex w-full items-center gap-4 lg:gap-8">
          <span className="w-6 shrink-0 text-center text-[10px]/[20px] font-semibold tracking-[0.05em] text-fg lg:w-7">
            {formatTime(currentTime)}
          </span>
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
              background: `linear-gradient(to right, #fcfcfc ${progress}%, #4c4e54 ${progress}%)`,
            }}
          />
          <span className="hidden w-7 shrink-0 text-center text-[10px]/[20px] font-semibold tracking-[0.05em] text-fg sm:block">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: volume / cast / queue / options */}
      <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-8">
        <div className="group/vol relative flex items-center gap-2">
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
            className={`cursor-pointer transition-colors ${
              muted ? "text-accent" : "text-fg hover:text-accent"
            }`}
          >
            <MdVolumeUp size={24} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={effectiveVolume}
            onChange={(event) => setVolumeValue(Number(event.target.value))}
            aria-label="Volume"
            className="player-range w-0 opacity-0 transition-all duration-200 group-hover/vol:w-24 group-hover/vol:opacity-100"
            style={{
              background: `linear-gradient(to right, #fcfcfc ${effectiveVolume * 100}%, #4c4e54 ${effectiveVolume * 100}%)`,
            }}
          />
        </div>
        <IconButton
          label="Open queue"
          open={queueOpen}
          onClick={() => {
            setQueueOpen((open) => !open);
            setOptionsOpen(false);
            setShortcutsOpen(false);
          }}
          className="hidden sm:block"
        >
          <MdQueueMusic size={24} />
        </IconButton>
        <IconButton label="Fullscreen player" onClick={onExpand}>
          <MdOpenInFull size={22} />
        </IconButton>
      </div>
    </footer>
  );
}
