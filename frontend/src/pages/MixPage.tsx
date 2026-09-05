import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { MdBookmarkAdd, MdPlayArrow, MdRefresh } from "react-icons/md";
import { ApiTrackList } from "../components/ApiTrackList";
import { SafeImage } from "../components/SafeImage";
import { EmptyState } from "../components/EmptyState";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import { useHistory } from "../utils/history";
import { buildTaste, tasteSignature } from "../utils/taste";
import { getMix, resolveDiscoveryItem, type MixResponse } from "../api/music";
import { resolvedToSnapshot } from "../utils/playlists";
import { formatTime } from "../utils/format";

/**
 * My Mix — auto-generated playlist from the listener's taste.
 * Regenerates when taste drifts; refresh forces a new curation.
 */
export function MixPage() {
  useDocumentTitle("My Mix");
  const history = useHistory();
  const { playlists } = usePlaylists();
  const taste = useMemo(
    () => buildTaste(history, playlists),
    [history, playlists],
  );
  // Cold start: charts carry the page, no taste needed.
  return (
    <MixBody
      key={tasteSignature(taste)}
      artists={taste.artists}
      exclude={taste.exclude}
    />
  );
}

function MixBody({
  artists,
  exclude,
}: {
  artists: string[];
  exclude: string[];
}) {
  const [mix, setMix] = useState<MixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [saving, setSaving] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  useDocumentTitle(mix?.name ?? "My Mix");
  const { currentTrack, isPlaying } = usePlayer();
  const { createPlaylist, addTrack } = usePlaylists();
  const { playItems, isResolving, resolvingKey, playError, clearPlayError } =
    usePlayDiscovery();

  useEffect(() => {
    let cancelled = false;
    // Bust the client view per refresh; backend caches per signature
    // unless fresh=true forces a full re-curation.
    getMix(artists, exclude, 20, nonce > 0)
      .then((data) => {
        if (cancelled) return;
        setMix(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load mix.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artists, exclude, nonce]);

  const tracks = mix?.tracks ?? [];
  const totalDuration = tracks.reduce(
    (sum, t) => sum + (typeof t.duration === "number" ? t.duration : 0),
    0,
  );

  /** Save the whole generated mix as a user playlist (with progress). */
  const saveMix = async () => {
    if (!mix || saving > 0) return;
    const playlist = createPlaylist({
      name: mix.name,
      description: mix.blurb || "Saved mix",
    });
    setSavedId(playlist.id);
    let done = 0;
    let failed = 0;
    for (const item of tracks) {
      try {
        const resolved = await resolveDiscoveryItem(item);
        addTrack(playlist.id, resolvedToSnapshot(resolved));
      } catch {
        failed += 1;
      }
      done += 1;
      setSaving(done);
    }
    setSaving(0);
    if (done - failed > 0) {
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span className="font-medium">
              Saved {done - failed} song{done - failed === 1 ? "" : "s"} to{" "}
              {mix.name}
              {failed > 0 ? ` (${failed} skipped)` : ""}
            </span>
            <Link
              to={`/playlist/${playlist.id}`}
              onClick={() => toast.dismiss(t.id)}
              className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-black transition-transform hover:scale-105"
            >
              View
            </Link>
          </span>
        ),
        { id: `mix-saved-${playlist.id}` },
      );
    } else {
      toast.error("Couldn't save this mix — nothing resolved.");
    }
  };

  if (loading) {
    return (
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="h-44 w-44 animate-pulse rounded-lg bg-white/5 md:h-56 md:w-56" />
          <div className="min-w-0 flex-1">
            <div className="h-9 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !mix || tracks.length === 0) {
    return (
      <div className="px-6 pt-6">
        <EmptyState
          title="Couldn't build your mix"
          description={error ?? "Try again in a moment."}
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <div className="grid h-44 w-44 grid-cols-2 overflow-hidden rounded-lg shadow-xl-dark md:h-56 md:w-56">
          {tracks.slice(0, 4).map((t, i) => (
            <SafeImage
              key={`${t.id}-${i}`}
              src={t.thumbnail ?? ""}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Playlist • Made for you{" "}
            {mix.curated && (
              <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                Curated
              </span>
            )}
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {mix.name}
          </h1>
          {mix.blurb && (
            <p className="mt-2 line-clamp-2 max-w-xl text-[14px]/[20px] text-fg/70">
              {mix.blurb}
            </p>
          )}
          <p className="mt-2 text-[13px]/[18px] text-subtle">
            {tracks.length} songs • {formatTime(totalDuration)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void playItems(tracks, 0)}
          disabled={resolvingKey !== null}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MdPlayArrow size={20} /> Play
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            setMix(null);
            setSavedId(null);
            setNonce((n) => n + 1);
          }}
          disabled={resolvingKey !== null}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-elevated px-5 py-3 text-[14px]/[20px] font-semibold text-fg transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MdRefresh size={18} /> Refresh mix
        </button>
        {savedId ? (
          <Link
            to={`/playlist/${savedId}`}
            className="flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-5 py-3 text-[14px]/[20px] font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            <MdBookmarkAdd size={18} /> View saved playlist
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void saveMix()}
            disabled={saving > 0 || resolvingKey !== null}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-elevated px-5 py-3 text-[14px]/[20px] font-semibold text-fg transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          >
            <MdBookmarkAdd size={18} />{" "}
            {saving > 0 ? `Saving ${saving}/${tracks.length}…` : "Save mix"}
          </button>
        )}
      </div>

      {playError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/40 bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg"
        >
          {playError}{" "}
          <button
            type="button"
            onClick={clearPlayError}
            className="cursor-pointer font-semibold text-accent hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-2">
        <ApiTrackList
          items={tracks}
          currentTitle={currentTrack?.title}
          isPlaying={isPlaying}
          onPlay={(i) => void playItems(tracks, i)}
          isResolvingItem={isResolving}
          resolvingActive={resolvingKey !== null}
          enableAdd
        />
      </div>

      <p className="mt-6 text-[12px]/[16px] text-subtle">
        Something off?{" "}
        <Link
          to="/liked"
          className="font-semibold text-fg hover:text-accent"
        >
          Liked Songs
        </Link>{" "}
        and your playlists steer the next one.
      </p>
    </div>
  );
}
