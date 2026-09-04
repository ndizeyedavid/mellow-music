import { MdFavorite, MdFavoriteBorder, MdQueueMusic } from "react-icons/md";
import { SafeImage } from "./SafeImage";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { formatTime } from "../utils/format";
import { Marquee } from "./Marquee";

/** Inner scrollable content shared by the desktop panel and mobile overlay. */
export function NowPlayingPanelContent({ onArtwork }: { onArtwork: () => void }) {
  const { queue, currentTrack, currentIndex, playFrom } = usePlayer();
  const { isSongLiked, toggleLikeSong } = useLibrary();

  if (!currentTrack) {
    return (
      <div className="flex h-full md:h-[700px] w-[340px] flex-col items-center justify-center gap-3 p-5 text-center">
        <MdQueueMusic size={32} className="text-subtle" />
        <p className="text-[14px]/[20px] font-semibold text-fg">
          Nothing playing yet
        </p>
        <p className="text-[13px]/[18px] text-subtle">
          Played songs and the queue will appear here.
        </p>
      </div>
    );
  }

  const liked = isSongLiked(currentTrack.id);

  const upNext = queue
    .map((track, index) => ({ track, index }))
    .filter(({ index }) => index !== currentIndex);

  return (
    <div className="h-full md:h-[700px] w-[340px] overflow-y-auto p-5 pb-32">
      {/* Now playing */}
      <section>
        <button
          type="button"
          onClick={onArtwork}
          aria-label={`Open artwork for ${currentTrack.title}`}
          title="Open artwork"
          className="block w-full cursor-pointer rounded-xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <SafeImage
            src={currentTrack.image}
            alt={`${currentTrack.title} cover`}
            className="aspect-square w-full rounded-xl object-cover shadow-xl-dark"
          />
        </button>
        <div className="mt-4">
          <Marquee className="text-[22px]/[28px] font-bold text-fg">
            {currentTrack.title}
          </Marquee>
          <Marquee className="mt-1 text-[14px]/[20px] font-semibold text-subtle">
            {currentTrack.artist}
          </Marquee>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px]/[16px] font-medium uppercase tracking-wide text-subtle">
              Playing from {currentTrack.album}
            </span>
            <button
              type="button"
              aria-label={liked ? "Remove from liked" : "Add to liked"}
              aria-pressed={liked}
              onClick={() => toggleLikeSong(currentTrack.id)}
              className={`cursor-pointer rounded-full p-1.5 transition-colors hover:text-accent ${
                liked ? "text-accent" : "text-fg"
              }`}
            >
              {liked ? (
                <MdFavorite size={20} />
              ) : (
                <MdFavoriteBorder size={20} />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Track meta */}
      <section className="mt-8">
        <h3 className="text-[10px]/[12px] font-semibold uppercase tracking-wide text-subtle">
          Details
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-sidebar px-3 py-1 text-[12px]/[16px] font-medium text-fg">
            {formatTime(currentTrack.duration)}
          </span>
          {currentTrack.genre && (
            <span className="rounded-full bg-sidebar px-3 py-1 text-[12px]/[16px] font-medium text-fg">
              {currentTrack.genre}
            </span>
          )}
        </div>
      </section>

      {/* Next in queue */}
      <section className="mt-8">
        <h3 className="text-[10px]/[12px] font-semibold uppercase tracking-wide text-subtle">
          Next in queue
        </h3>
        <ul className="mt-2">
          {upNext.map(({ track, index }) => (
            <li key={`${track.title}-${index}`}>
              <button
                type="button"
                onClick={() => playFrom(index)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
              >
                <SafeImage
                  src={track.image}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-md object-cover"
                />
                <span className="min-w-0 flex-1">
                  <Marquee className="text-[14px]/[20px] font-semibold text-fg">
                    {track.title}
                  </Marquee>
                  <span className="block truncate text-[12px]/[16px] text-subtle">
                    {track.artist}
                  </span>
                </span>
                <span className="shrink-0 text-[12px]/[16px] font-medium text-subtle">
                  {formatTime(track.duration ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface NowPlayingPanelProps {
  open: boolean;
  onArtwork: () => void;
}

/** Desktop inline collapsible panel (slides in width). */
export function NowPlayingPanel({ open, onArtwork }: NowPlayingPanelProps) {
  return (
    <aside
      aria-hidden={!open}
      className={`shrink-0 overflow-hidden border-l border-border bg-elevated transition-[width] duration-300 ease-out ${
        open ? "w-[340px]" : "w-0 border-l-0"
      }`}
    >
      {open && <NowPlayingPanelContent onArtwork={onArtwork} />}
    </aside>
  );
}
