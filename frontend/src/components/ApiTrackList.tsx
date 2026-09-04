import { MdPause, MdPlayArrow } from "react-icons/md";
import { Link } from "react-router-dom";
import { SafeImage } from "./SafeImage";
import { AddDiscoveryButton } from "./AddToPlaylist";
import { QueueMenuButton } from "./QueueMenu";
import { resolveDiscoveryItem } from "../api/music";
import type { ApiDiscoveryItem } from "../api/music";
import { formatTime } from "../utils/format";

/**
 * Track rows for API-backed detail pages (album / artist / playlist).
 * Playback resolves via prepare -> fetch; the player bar shows the state.
 */
export function ApiTrackList({
  items,
  currentTitle,
  isPlaying,
  onPlay,
  isResolvingItem,
  resolvingActive,
  enableAdd = false,
}: {
  items: ApiDiscoveryItem[];
  currentTitle?: string;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  isResolvingItem: (item: ApiDiscoveryItem, index: number) => boolean;
  resolvingActive: boolean;
  enableAdd?: boolean;
}) {
  return (
    <ul className="mt-2">
      {items.map((item, index) => {
        const title = item.title?.trim() || "Unknown title";
        const artist = item.artist?.trim() || "Unknown artist";
        const resolving = isResolvingItem(item, index);
        return (
          <li
            key={`${item.id}-${index}`}
            className="group grid grid-cols-[2.5rem_minmax(0,1fr)_7rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
          >
            <span className="flex w-10 justify-center">
              {resolving ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-fg"
                  role="status"
                  aria-label={`Loading ${title}`}
                />
              ) : (
                <>
                  <span className="text-[14px] tabular-nums text-subtle group-hover:hidden">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Play ${title}`}
                    disabled={resolvingActive}
                    onClick={() => onPlay(index)}
                    className="hidden cursor-pointer text-fg hover:text-accent group-hover:block disabled:cursor-wait"
                  >
                    <MdPlayArrow size={18} />
                  </button>
                </>
              )}
            </span>

            <div className="flex min-w-0 items-center gap-3">
              <SafeImage
                src={item.thumbnail ?? ""}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
              <div className="min-w-0">
                <Link
                  to={`/song/${encodeURIComponent(title)}`}
                  className="block truncate text-[14px]/[20px] font-semibold text-fg transition-colors hover:text-accent"
                >
                  {title}
                </Link>
                <p className="block truncate text-[12px]/[16px] text-subtle">
                  {artist}
                </p>
              </div>
              {currentTitle === title && isPlaying && (
                <MdPause size={14} className="shrink-0 text-accent" />
              )}
            </div>

            <span className="flex items-center justify-end gap-0 text-right text-[13px] tabular-nums text-subtle">
              {typeof item.duration === "number" && item.duration > 0
                ? formatTime(item.duration)
                : "--:--"}
              {enableAdd && (
                <span className="hidden group-hover:inline-flex">
                  <AddDiscoveryButton items={items} index={index} />
                  <QueueMenuButton
                    label={title}
                    preview={{
                      title,
                      artist,
                      thumbnail: item.thumbnail ?? "",
                      duration:
                        typeof item.duration === "number" ? item.duration : 0,
                    }}
                    getTrack={() => resolveDiscoveryItem(items[index])}
                  />
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
