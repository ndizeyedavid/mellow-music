import { useEffect, useRef, useState } from "react";
import { MdAdd, MdCheck, MdClose } from "react-icons/md";
import { SafeImage } from "./SafeImage";
import {
  playlistCover,
  type NewSavedTrack,
  type UserPlaylist,
} from "../utils/playlists";
import { usePlaylists } from "../context/PlaylistContext";
import { resolveDiscoveryItem, type ApiDiscoveryItem } from "../api/music";
import type { Track } from "../types";

/* ------------------------------------------------------------------ */
/* Picker popover: choose a playlist, or create one inline             */
/* ------------------------------------------------------------------ */

function PlaylistPicker({
  onPick,
  onClose,
}: {
  onPick: (playlist: UserPlaylist) => void;
  onClose: () => void;
}) {
  const { playlists, createPlaylist } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const submitNew = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onPick(createPlaylist({ name: trimmed, description: "" }));
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Add to playlist"
      className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-xl border border-border bg-elevated p-1.5 shadow-xl-dark"
      onClick={(e) => e.stopPropagation()}
    >
      {playlists.length === 0 && !creating && (
        <p className="px-3 py-2 text-[13px] text-subtle">
          No playlists yet — create one below.
        </p>
      )}
      <div className="max-h-56 overflow-y-auto">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            type="button"
            role="menuitem"
            onClick={() => onPick(playlist)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
          >
            <SafeImage
              src={playlistCover(playlist)}
              alt=""
              className="h-9 w-9 shrink-0 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px]/[20px] font-semibold text-fg">
                {playlist.name}
              </span>
              <span className="block text-[12px]/[16px] text-subtle">
                {playlist.tracks.length} songs
              </span>
            </span>
          </button>
        ))}
      </div>
      {creating ? (
        <div className="flex items-center gap-2 border-t border-border p-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
            }}
            placeholder="Playlist name"
            aria-label="New playlist name"
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-accent/50"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={!name.trim()}
            aria-label="Create playlist"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-fg text-[#171719] disabled:opacity-40"
          >
            <MdCheck size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border-t border-border px-3 py-2.5 text-left text-[13px] font-semibold text-fg transition-colors hover:bg-white/5 hover:text-accent"
        >
          <MdAdd size={16} /> New playlist
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared add-button shell (plus -> picker -> check feedback)          */
/* ------------------------------------------------------------------ */

function AddShell({
  label,
  resolve,
}: {
  label: string;
  resolve: () => Promise<NewSavedTrack>;
}) {
  const { addTrack } = usePlaylists();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (playlist: UserPlaylist) => {
    setBusy(true);
    setError(null);
    try {
      const snapshot = await resolve();
      const added = addTrack(playlist.id, snapshot);
      setOpen(false);
      if (added) {
        setDone(true);
        window.setTimeout(() => setDone(false), 1600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add track.");
    } finally {
      setBusy(false);
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
        disabled={busy}
        aria-label={done ? `Saved ${label}` : `Add ${label} to playlist`}
        title={done ? "Saved!" : "Add to playlist"}
        className={`cursor-pointer rounded-full p-2 transition-all active:scale-90 disabled:cursor-wait ${
          done ? "text-accent" : "text-fg hover:text-accent"
        }`}
      >
        {busy ? (
          <span
            className="block h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-fg"
            role="status"
            aria-label="Saving"
          />
        ) : done ? (
          <MdCheck size={16} />
        ) : (
          <MdAdd size={16} />
        )}
      </button>
      {open && (
        <>
          <PlaylistPicker onPick={(p) => void pick(p)} onClose={() => setOpen(false)} />
          {error && (
            <span className="absolute bottom-full right-0 z-50 mb-2 flex w-56 items-center gap-2 rounded-xl border border-danger/40 bg-elevated px-3 py-2 text-[12px] font-medium text-fg">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setError(null)}
                className="cursor-pointer text-subtle hover:text-fg"
              >
                <MdClose size={14} />
              </button>
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** Add button for a fully-resolved Track (player bar, fresh history rows). */
export function AddTrackButton({ track }: { track: Track }) {
  return (
    <AddShell
      label={track.title}
      resolve={async () => ({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        thumbnail: track.image,
        backdrop: track.backdrop ?? null,
        duration: track.duration,
        audioUrl: track.source,
        expiresAt: track.expiresAt ?? null,
      })}
    />
  );
}

/** Add button for discovery rows: resolves prepare -> fetch, then saves. */
export function AddDiscoveryButton({
  items,
  index,
}: {
  items: ApiDiscoveryItem[];
  index: number;
}) {
  const item = items[index];
  const title = item?.title?.trim() || "Unknown title";
  return (
    <AddShell
      label={title}
      resolve={async () => {
        const resolved = await resolveDiscoveryItem(items[index]);
        return {
          trackId: resolved.id,
          title: resolved.title,
          artist: resolved.artist,
          thumbnail: resolved.image,
          backdrop: resolved.backdrop ?? null,
          duration: resolved.duration,
          audioUrl: resolved.source,
          expiresAt: resolved.expiresAt ?? null,
        };
      }}
    />
  );
}
