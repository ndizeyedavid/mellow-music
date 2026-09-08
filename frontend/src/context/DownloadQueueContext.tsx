import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { saveOfflineSong, type OfflineSong } from "../utils/offlineDB";
import { fetchSongById, prepareSong } from "../api/music";
import type { Track } from "../types";

type JobStatus = "queued" | "downloading" | "done" | "error";

interface Job {
  id: string;
  title: string;
  artist: string;
  track: Track;
  status: JobStatus;
  bytesProgress: number; // 0-100 for current file
  error?: string;
}

interface QueueState {
  jobs: Job[];
  active: Job | null;
  completed: number;
  total: number;
  overallPct: number; // 0-100
  enqueue: (tracks: Track[]) => void;
  enqueueOne: (track: Track) => void;
}

const Ctx = createContext<QueueState | null>(null);

async function resolveAudio(track: Track): Promise<{ url: string; id: string; track: Track }> {
  let url = track.source;
  let id = track.id;
  let resolved = track;
  if (!url) {
    const pid = await prepareSong(track.title);
    const fetched = await fetchSongById(pid);
    if (!fetched.AUDIO_URL) throw new Error("No audio for offline save");
    url = fetched.AUDIO_URL;
    id = fetched.ID;
    resolved = {
      ...track,
      id,
      source: url,
      duration: fetched.DURATION || track.duration,
      image: fetched.THUMBNAIL || track.image,
    };
  }
  return { url, id, track: resolved };
}

async function fetchWithProgress(url: string, onBytes: (pct: number) => void): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  const reader = res.body?.getReader();
  if (!reader || !len) {
    // Fallback: no progress granularity
    const blob = await res.blob();
    onBytes(100);
    return blob;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onBytes(Math.round((received / len) * 100));
    }
  }
  const mime = res.headers.get("content-type") || "audio/mpeg";
  return new Blob(chunks as BlobPart[], { type: mime });
}

export function DownloadQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const runningRef = useRef(false);

  const active = jobs.find((j) => j.status === "downloading") || null;
  const completed = jobs.filter((j) => j.status === "done").length;
  const total = jobs.length;
  const overallPct = total === 0 ? 0 : Math.round((completed / total) * 100 + (active ? active.bytesProgress / total : 0));

  const setJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      // Find next queued job
      let next: Job | undefined;
      // eslint-disable-next-line no-constant-condition
      while ((next = jobs.find((j) => j.status === "queued"))) {
        const job = next;
        setJob(job.id, { status: "downloading", bytesProgress: 0 });
        try {
          const { url, id, track } = await resolveAudio(job.track);
          const blob = await fetchWithProgress(url, (pct) => setJob(job.id, { bytesProgress: pct }));
          const offline: OfflineSong = {
            id,
            title: track.title,
            artist: track.artist,
            image: track.image,
            duration: track.duration,
            audioBlob: blob,
            mimeType: blob.type || "audio/mpeg",
            savedAt: Date.now(),
            size: blob.size,
          };
          await saveOfflineSong(offline);
          setJob(job.id, { status: "done", bytesProgress: 100 });
        } catch (err) {
          setJob(job.id, { status: "error", error: err instanceof Error ? err.message : "Failed" });
          toast.error(`Offline failed: ${job.title} — ${err instanceof Error ? err.message : "error"}`);
        }
        // Small tick to let state settle before next
        await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      runningRef.current = false;
    }
  }, [jobs, setJob]);

  // Kick processor when jobs change
  useEffect(() => {
    if (jobs.some((j) => j.status === "queued") && !runningRef.current) {
      void processQueue();
    }
    // Auto-clear completed/error after 4s of idle
    if (jobs.length > 0 && jobs.every((j) => j.status === "done" || j.status === "error")) {
      const t = window.setTimeout(() => setJobs([]), 4000);
      return () => window.clearTimeout(t);
    }
  }, [jobs, processQueue]);

  const enqueue = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return;
    const newJobs: Job[] = tracks.map((t) => ({
      id: `${t.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: t.title,
      artist: t.artist,
      track: t,
      status: "queued" as const,
      bytesProgress: 0,
    }));
    // Deduplicate against already queued/downloading/done
    setJobs((prev) => {
      const seen = new Set(prev.map((j) => j.track.id));
      const filtered = newJobs.filter((j) => !seen.has(j.track.id));
      if (filtered.length === 0) {
        toast("Already queued for offline", { icon: "✓" });
        return prev;
      }
      toast.success(`Queued ${filtered.length} song${filtered.length > 1 ? "s" : ""} for offline`);
      return [...prev, ...filtered];
    });
  }, []);

  const enqueueOne = useCallback((track: Track) => enqueue([track]), [enqueue]);

  return <Ctx.Provider value={{ jobs, active, completed, total, overallPct, enqueue, enqueueOne }}>{children}</Ctx.Provider>;
}

export function useDownloadQueue(): QueueState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDownloadQueue must be used within DownloadQueueProvider");
  return ctx;
}
