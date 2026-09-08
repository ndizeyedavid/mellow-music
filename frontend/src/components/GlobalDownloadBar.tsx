import { useDownloadQueue } from "../context/DownloadQueueContext";

/**
 * Global download progress — top container is the overall 1/4 fill,
 * thin bar underneath is the current file's byte progress.
 */
export function GlobalDownloadBar() {
  const { jobs, active, completed, total, overallPct } = useDownloadQueue();

  if (total === 0) return null;

  const label = active
    ? `${completed + 1}/${total} songs — ${active.title} · ${active.artist}`
    : `${completed}/${total} songs downloaded`;

  return (
    <div className="pointer-events-none fixed left-1/2 top-2 z-[85] w-[min(560px,calc(100vw-32px))] -translate-x-1/2">
      {/* Overall container — itself the progress bar */}
      <div className="relative overflow-hidden rounded-full border border-white/10 bg-elevated shadow-xl">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-all duration-300 ease-out"
          style={{ width: `${overallPct}%` }}
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]/[18px] font-semibold">
          <span className="truncate text-fg drop-shadow">{label}</span>
          <span className="shrink-0 tabular-nums text-fg drop-shadow">{overallPct}%</span>
        </div>
      </div>
      {/* Current song byte progress — thin */}
      {active && (
        <div className="mx-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-white transition-all duration-150 ease-out"
            style={{ width: `${active.bytesProgress}%` }}
            role="progressbar"
            aria-valuenow={active.bytesProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Downloading ${active.title} ${active.bytesProgress}%`}
          />
        </div>
      )}
      {/* Done/error summary when idle but still visible for 4s */}
      {!active && total > 0 && (
        <p className="mt-1 text-center text-[11px] text-subtle">
          {jobs.filter((j) => j.status === "error").length > 0
            ? `${jobs.filter((j) => j.status === "error").length} failed — will retry on next queue`
            : "All queued songs saved for offline"}
        </p>
      )}
    </div>
  );
}
