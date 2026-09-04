import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MdDeleteOutline, MdPlayArrow } from "react-icons/md";
import { EmptyState } from "../components/EmptyState";
import { SafeImage } from "../components/SafeImage";
import { AddTrackButton } from "../components/AddToPlaylist";
import { usePlayer } from "../context/PlayerContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { resolveDiscoveryItem } from "../api/music";
import {
  clearHistory,
  historyEntryToDiscovery,
  historyEntryToTrack,
  isEntryFresh,
  useHistory,
  type HistoryEntry,
} from "../utils/history";
import { formatTime, timeAgo } from "../utils/format";

type SortKey = "recent" | "title" | "artist" | "duration";

const sortOptions: Array<{ id: SortKey; label: string }> = [
  { id: "recent", label: "Recent" },
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
  { id: "duration", label: "Duration" },
];

/** Recently Played: real play history with filter, sort, replay and clear. */
export function TracksPage() {
  useDocumentTitle("History");
  const history = useHistory();
  const { currentTrack, replaceQueue } = usePlayer();
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = history.filter(
      (entry) =>
        !q ||
        entry.title.toLowerCase().includes(q) ||
        entry.artist.toLowerCase().includes(q),
    );
    switch (sortKey) {
      case "title":
        return [...list].sort((a, b) => a.title.localeCompare(b.title));
      case "artist":
        return [...list].sort((a, b) => a.artist.localeCompare(b.artist));
      case "duration":
        return [...list].sort((a, b) => a.duration - b.duration);
      case "recent":
      default:
        return list; // already most-recent-first
    }
  }, [history, query, sortKey]);

  /** Replay a history entry: fresh snapshot plays instantly, else re-resolve. */
  const playEntry = async (entry: HistoryEntry) => {
    if (resolvingId !== null) return;
    setPlayError(null);
    if (isEntryFresh(entry)) {
      replaceQueue([historyEntryToTrack(entry)], 0);
      return;
    }
    setResolvingId(entry.trackId);
    try {
      const track = await resolveDiscoveryItem(
        historyEntryToDiscovery(entry),
      );
      replaceQueue([track], 0);
    } catch (err) {
      setPlayError(
        err instanceof Error ? err.message : "Could not play this track.",
      );
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl/[32px] font-bold text-fg">
            Recently Played
          </h1>
          <p className="mt-1 text-[14px] text-subtle">
            {history.length === 0
              ? "Nothing here yet"
              : `${history.length} song${history.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter history…"
            aria-label="Filter history"
            className="h-10 w-48 rounded-full border border-border bg-elevated px-4 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-accent/50"
          />
          {history.length > 0 &&
            (confirmingClear ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setConfirmingClear(false);
                  }}
                  className="cursor-pointer rounded-full bg-danger px-5 py-2.5 text-[14px]/[20px] font-semibold text-white transition-transform hover:scale-105"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="cursor-pointer rounded-full border border-border bg-elevated px-5 py-2.5 text-[14px]/[20px] font-semibold text-fg transition-colors hover:bg-white/10"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                aria-label="Clear history"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated text-fg transition-colors hover:bg-white/10 hover:text-danger"
              >
                <MdDeleteOutline size={20} />
              </button>
            ))}
        </div>
      </div>

      {/* Sort controls */}
      {history.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium uppercase tracking-wide text-subtle">
            Sort by
          </span>
          {sortOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={sortKey === option.id}
              onClick={() => setSortKey(option.id)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px]/[18px] font-semibold transition-colors ${
                sortKey === option.id
                  ? "bg-accent/15 text-accent"
                  : "bg-elevated text-fg hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {playError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/40 bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg"
        >
          {playError}
        </div>
      )}

      {/* History list */}
      {history.length === 0 ? (
        <EmptyState
          title="No recent plays"
          description="Songs you play will show up here, ready to replay."
          action={
            <Link
              to="/"
              className="inline-block rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Discover music
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try adjusting your filter."
        />
      ) : (
        <ul className="mt-4" aria-label="Recently played">
          {visible.map((entry, index) => {
            const isCurrent = currentTrack?.id === entry.trackId;
            const resolving = resolvingId === entry.trackId;
            return (
              <li
                key={`${entry.trackId}-${entry.playedAt}`}
                className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors md:grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1fr)_5.5rem] ${
                  isCurrent ? "bg-white/5" : "hover:bg-white/5"
                }`}
              >
                <span className="flex w-10 justify-center">
                  {resolving ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-fg"
                      role="status"
                      aria-label={`Loading ${entry.title}`}
                    />
                  ) : (
                    <>
                      <span className="text-[14px] tabular-nums text-subtle group-hover:hidden">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Play ${entry.title}`}
                        onClick={() => void playEntry(entry)}
                        className="hidden cursor-pointer text-fg hover:text-accent group-hover:block"
                      >
                        <MdPlayArrow size={18} />
                      </button>
                    </>
                  )}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  <SafeImage
                    src={entry.thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <Link
                      to={`/song/${encodeURIComponent(entry.title)}`}
                      className={`block truncate text-[14px]/[20px] font-semibold transition-colors hover:text-accent ${
                        isCurrent ? "text-accent" : "text-fg"
                      }`}
                    >
                      {entry.title}
                    </Link>
                    <p className="block truncate text-[12px]/[16px] text-subtle">
                      {entry.artist}
                    </p>
                  </div>
                </div>

                <span className="hidden truncate text-[13px]/[18px] text-subtle md:block">
                  {timeAgo(entry.playedAt)}
                </span>

                <span className="flex items-center justify-end gap-0 text-right text-[13px] tabular-nums text-subtle">
                  {formatTime(entry.duration)}
                  <AddTrackButton track={historyEntryToTrack(entry)} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
