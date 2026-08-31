import { MdFavorite, MdFavoriteBorder } from "react-icons/md";
import { artistMap, playerQueue } from "../data/library";
import { usePlayer } from "../context/PlayerContext";
import { formatTime } from "../utils/format";
import { Marquee } from "./Marquee";

interface NowPlayingPanelProps {
  open: boolean;
}

/** Collapsible right-side panel: now playing, about the artist, next in queue. */
export function NowPlayingPanel({ open }: NowPlayingPanelProps) {
  const { currentTrack, currentIndex, liked, toggleLike, playFrom } =
    usePlayer();

  const artist =
    artistMap[currentTrack.artist] ?? {
      name: currentTrack.artist,
      image: currentTrack.image,
      description: "Independent artist on Mellow Music.",
      monthlyListeners: "—",
      followers: "—",
    };

  const upNext = playerQueue
    .map((track, index) => ({ track, index }))
    .filter(({ index }) => index !== currentIndex);

  return (
    <aside
      aria-hidden={!open}
      className={`shrink-0 overflow-hidden border-l border-border bg-elevated transition-[width] duration-300 ease-out ${
        open ? "w-[340px]" : "w-0 border-l-0"
      }`}
    >
      <div className="h-full w-[340px] overflow-y-auto p-5 pb-32">
        {/* Now playing */}
        <section>
          <img
            src={currentTrack.image}
            alt={`${currentTrack.title} cover`}
            className="aspect-square w-full rounded-xl object-cover shadow-xl-dark"
          />
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
                onClick={toggleLike}
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

        {/* About the artist */}
        <section className="mt-8">
          <h3 className="text-[10px]/[12px] font-semibold uppercase tracking-wide text-subtle">
            About the artist
          </h3>
          <img
            src={artist.image}
            alt={artist.name}
            className="mt-3 h-40 w-full rounded-xl object-cover"
          />
          <h4 className="mt-3 text-[18px]/[24px] font-semibold text-fg">
            {artist.name}
          </h4>
          <p className="mt-1 line-clamp-4 text-[14px]/[20px] text-subtle">
            {artist.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-sidebar px-3 py-1 text-[12px]/[16px] font-medium text-fg">
              {artist.monthlyListeners} monthly listeners
            </span>
            <span className="rounded-full bg-sidebar px-3 py-1 text-[12px]/[16px] font-medium text-fg">
              {artist.followers} followers
            </span>
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
                  <img
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
    </aside>
  );
}
