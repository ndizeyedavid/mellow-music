import { useState } from "react";
import toast from "react-hot-toast";
import { MdClose, MdPlaylistAdd } from "react-icons/md";
import { usePlayer } from "../context/PlayerContext";
import type { Track } from "../types";

/** Known metadata shown instantly while the audio URL resolves. */
export interface QueuePreview {
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

/**
 * "Add to queue" affordance for any row: the track appears in the queue
 * instantly as a placeholder, then swaps in once the backend returns the
 * audio URL (confirmed with a top-center toast). Never autoplays.
 */
export function QueueMenuButton({
  label,
  preview,
  getTrack,
}: {
  label: string;
  preview: QueuePreview;
  getTrack: () => Promise<Track>;
}) {
  const { queueNext, queueLast, replaceQueuedTrack, removeFromQueue } =
    usePlayer();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = (id: string): Track => ({
    id,
    title: preview.title,
    artist: preview.artist,
    artistId: "",
    album: "",
    albumId: "",
    image: preview.thumbnail,
    source: "",
    duration: preview.duration,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
  });

  const run = async (where: "next" | "last") => {
    // Fresh id per run so repeat queues never collide.
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setError(null);
    setOpen(false);
    // Instant: show the row in the queue right away.
    if (where === "next") queueNext(placeholder(id));
    else queueLast(placeholder(id));
    try {
      const track = await getTrack();
      if (!track.source) throw new Error("No playable audio for this track.");
      replaceQueuedTrack(id, track);
      toast.success(`Audio ready — ${track.title} in queue`, {
        id: `queue-ready-${id}`,
      });
    } catch (err) {
      // Revert the placeholder so dead rows never linger.
      removeFromQueue(id);
      setError(err instanceof Error ? err.message : "Could not queue track.");
      toast.error(`Couldn't resolve ${preview.title}`, {
        id: `queue-fail-${id}`,
      });
    }
  };

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setError(null);
          setOpen((o) => !o);
        }}
        aria-label={`Add ${label} to queue`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Add to queue"
        className="cursor-pointer rounded-full p-2 text-fg transition-all hover:text-accent active:scale-90"
      >
        <MdPlaylistAdd size={16} />
      </button>
      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            aria-label={`Queue ${label}`}
            className="absolute bottom-full right-0 z-50 mb-2 w-48 rounded-xl border border-border bg-elevated p-1.5 shadow-xl-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => void run("next")}
              className="flex w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-fg transition-colors hover:bg-white/5"
            >
              Play next
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void run("last")}
              className="flex w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-fg transition-colors hover:bg-white/5"
            >
              Add to queue
            </button>
            {error && (
              <p className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-fg">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setError(null)}
                  className="cursor-pointer text-subtle hover:text-fg"
                >
                  <MdClose size={14} />
                </button>
              </p>
            )}
          </div>
        </>
      )}
    </span>
  );
}
