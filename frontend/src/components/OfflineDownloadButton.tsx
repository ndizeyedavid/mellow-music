import { useState } from "react";
import { MdCloudDownload, MdDelete, MdDownloadDone } from "react-icons/md";
import toast from "react-hot-toast";
import { useOfflineStatus } from "../hooks/useOfflineDownloads";
import { useDownloadQueue } from "../context/DownloadQueueContext";
import type { Track } from "../types";
import type { ApiDiscoveryItem } from "../api/music";

function toTrack(item: ApiDiscoveryItem | Track): Track {
  if ((item as Track).source !== undefined) return item as Track;
  const d = item as ApiDiscoveryItem;
  return {
    id: d.id || `disc-${d.title}`,
    title: d.title || "Unknown",
    artist: d.artist || "Unknown",
    artistId: `api-artist-${d.artist}`,
    album: "Mellow Discovery",
    albumId: "api-discovery",
    image: d.thumbnail || "",
    source: "",
    duration: d.duration || 0,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "Discovery",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
  };
}

export function OfflineDownloadButton({
  track,
  size = 16,
}: {
  track: Track | ApiDiscoveryItem;
  size?: number;
}) {
  const t = toTrack(track);
  const { saved, checking } = useOfflineStatus(t.id);
  const { enqueueOne, jobs } = useDownloadQueue();
  const queued = jobs.some((j) => j.track.id === t.id && j.status !== "done" && j.status !== "error");
  const job = jobs.find((j) => j.track.id === t.id);

  if (checking) {
    return <span className="h-4 w-4 animate-pulse rounded-full bg-white/10" />;
  }

  if (saved) {
    return (
      <span title="Available offline" className="flex items-center gap-1 text-emerald-400">
        <MdDownloadDone size={size} />
      </span>
    );
  }

  if (queued) {
    return (
      <span title={`Queued ${job?.bytesProgress ?? 0}%`} className="flex items-center gap-1 text-accent">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
        <span className="text-[11px] tabular-nums">{job?.bytesProgress ?? 0}%</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        enqueueOne(t);
      }}
      aria-label={`Save ${t.title} for offline`}
      title="Save for offline"
      className="cursor-pointer rounded-full p-2 text-fg transition-colors hover:text-accent"
    >
      <MdCloudDownload size={size} />
    </button>
  );
}

export function OfflineRemoveButton({ id, onDone }: { id: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        const { deleteOfflineSong } = await import("../utils/offlineDB");
        await deleteOfflineSong(id);
        toast.success("Removed from offline");
        onDone?.();
        setBusy(false);
      }}
      aria-label="Remove offline"
      className="cursor-pointer rounded-full p-2 text-subtle transition-colors hover:text-danger disabled:opacity-60"
    >
      <MdDelete size={16} />
    </button>
  );
}
