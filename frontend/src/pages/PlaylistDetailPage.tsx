import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  MdArrowDownward,
  MdArrowUpward,
  MdClose,
  MdDeleteOutline,
  MdEdit,
  MdPlayArrow,
} from "react-icons/md";
import { ApiTrackList } from "../components/ApiTrackList";
import { SafeImage } from "../components/SafeImage";
import { EmptyState } from "../components/EmptyState";
import { PlaylistForm } from "../components/PlaylistForm";
import { usePlayer } from "../context/PlayerContext";
import { playlistCover } from "../utils/playlists";
import { usePlaylists } from "../context/PlaylistContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery, type ResolvableItem } from "../hooks/usePlayDiscovery";
import {
  getPlaylist,
  type ApiDiscoveryItem,
  type ApiPlaylist,
} from "../api/music";
import { formatTime } from "../utils/format";

const isApiId = (id: string) => /^\d+$/.test(id);

/** Playlist detail: curated (API) or user-created (local). */
export function PlaylistDetailPage() {
  const { id = "" } = useParams();
  // Keyed so curated data refetches cleanly per playlist.
  if (isApiId(id)) return <ApiPlaylistDetail key={id} id={id} />;
  return <UserPlaylistDetail id={id} />;
}

/* ------------------------------------------------------------------ */
/* Curated branch (GET /api/playlist/{id})                             */
/* ------------------------------------------------------------------ */

function ApiPlaylistDetail({ id }: { id: string }) {
  const [playlist, setPlaylist] = useState<ApiPlaylist | null>(null);
  const [tracks, setTracks] = useState<ApiDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(playlist?.title);
  const { currentTrack, isPlaying } = usePlayer();
  const { playItems, isResolving, resolvingKey } = usePlayDiscovery();

  useEffect(() => {
    let cancelled = false;
    getPlaylist(id)
      .then((data) => {
        if (cancelled) return;
        setPlaylist(data.playlist);
        setTracks(data.tracks);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load playlist.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  if (error || !playlist) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Playlist not found</p>
        <p className="mt-1 text-[13px] text-subtle">{error}</p>
        <Link
          to="/"
          className="mt-3 inline-block text-[14px] font-semibold text-accent hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const totalDuration = tracks.reduce(
    (sum, t) => sum + (typeof t.duration === "number" ? t.duration : 0),
    0,
  );

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <SafeImage
          src={playlist.picture}
          alt={playlist.title}
          className="h-44 w-44 rounded-lg object-cover shadow-xl-dark md:h-56 md:w-56"
        />
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Playlist
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {playlist.title}
          </h1>
          {playlist.description && (
            <p className="mt-2 line-clamp-2 text-[14px]/[20px] text-fg/70">
              {playlist.description}
            </p>
          )}
          <p className="mt-2 text-[13px]/[18px] text-subtle">
            {playlist.creator ? `${playlist.creator} • ` : ""}
            {tracks.length} songs • {formatTime(totalDuration)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => tracks.length > 0 && void playItems(tracks, 0)}
          disabled={tracks.length === 0 || resolvingKey !== null}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MdPlayArrow size={20} /> Play
        </button>
      </div>

      <ApiTrackList
        items={tracks}
        currentTitle={currentTrack?.title}
        isPlaying={isPlaying}
        onPlay={(index) => void playItems(tracks, index)}
        isResolvingItem={isResolving}
        resolvingActive={resolvingKey !== null}
        enableAdd
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* User branch (local playlists v2)                                    */
/* ------------------------------------------------------------------ */

function UserPlaylistDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { playlists, updatePlaylist, removePlaylist, moveTrack, removeTrack } =
    usePlaylists();
  const { currentTrack, isPlaying } = usePlayer();
  const { playItems, isResolving, resolvingKey, playError, clearPlayError } =
    usePlayDiscovery();
  const [editing, setEditing] = useState(false);
  const playlist = playlists.find((item) => item.id === id);
  useDocumentTitle(playlist?.name);
  if (!playlist) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Playlist not found</p>
        <button
          type="button"
          onClick={() => navigate("/playlists")}
          className="mt-3 cursor-pointer text-[14px] font-semibold text-accent hover:underline"
        >
          Back to playlists
        </button>
      </div>
    );
  }

  const tracks = playlist.tracks;
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  // Snapshots play through the same prepare -> fetch pipeline; fresh ones
  // start instantly, expired ones re-resolve on play.
  const inputs: ResolvableItem[] = tracks.map((t) => ({
    id: t.trackId,
    title: t.title,
    artist: t.artist,
    thumbnail: t.thumbnail,
    duration: t.duration,
    url: "",
    audioUrl: t.audioUrl,
    expiresAt: t.expiresAt,
    backdrop: t.backdrop ?? null,
  }));

  return (
    <div className="px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <SafeImage
          src={playlistCover(playlist)}
          alt={playlist.name}
          className="h-44 w-44 rounded-lg object-cover shadow-xl-dark md:h-56 md:w-56"
        />
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Playlist
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {playlist.name}
          </h1>
          <p className="mt-2 line-clamp-2 text-[14px]/[20px] text-fg/70">
            {playlist.description}
          </p>
          <p className="mt-2 text-[13px]/[18px] text-subtle">
            {playlist.owner} • {tracks.length} songs •{" "}
            {formatTime(totalDuration)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => tracks.length > 0 && void playItems(inputs, 0)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={tracks.length === 0 || resolvingKey !== null}
        >
          <MdPlayArrow size={20} /> Play
        </button>
        <button
          type="button"
          aria-label="Edit playlist"
          onClick={() => setEditing(true)}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated text-fg transition-colors hover:bg-white/10 hover:text-accent"
        >
          <MdEdit size={20} />
        </button>
        <button
          type="button"
          aria-label="Delete playlist"
          onClick={() => {
            removePlaylist(playlist.id);
            navigate("/playlists");
          }}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-elevated text-fg transition-colors hover:bg-white/10 hover:text-danger"
        >
          <MdDeleteOutline size={20} />
        </button>
      </div>

      {/* Tracklist */}
      {playError && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg"
        >
          <span>{playError}</span>
          <button
            type="button"
            onClick={clearPlayError}
            aria-label="Dismiss playback error"
            className="cursor-pointer text-subtle hover:text-fg"
          >
            ✕
          </button>
        </div>
      )}
      {tracks.length === 0 ? (
        <EmptyState
          title="This playlist is empty"
          description="Find songs on Home or Search and tap + to save them here."
          action={
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Discover music
            </button>
          }
        />
      ) : (
        <ul className="mt-6">
          {tracks.map((song, index) => {
            const isCurrent = currentTrack?.id === song.trackId;
            const resolving = isResolving(inputs[index], index);
            return (
              <li
                key={`${song.trackId}-${index}`}
                className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  isCurrent ? "bg-white/5" : "hover:bg-white/5"
                }`}
              >
                <span className="flex w-10 justify-center">
                  {resolving ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-fg"
                      role="status"
                      aria-label={`Loading ${song.title}`}
                    />
                  ) : (
                    <>
                      <span className="text-[14px] tabular-nums text-subtle group-hover:hidden">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={
                          isCurrent && isPlaying ? "Pause" : `Play ${song.title}`
                        }
                        onClick={() => void playItems(inputs, index)}
                        disabled={resolvingKey !== null}
                        className={`hidden cursor-pointer group-hover:block disabled:cursor-wait ${
                          isCurrent ? "text-accent" : "text-fg hover:text-accent"
                        }`}
                      >
                        <MdPlayArrow size={18} />
                      </button>
                    </>
                  )}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  <SafeImage
                    src={song.thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p
                      className={`block truncate text-[14px]/[20px] font-semibold ${
                        isCurrent ? "text-accent" : "text-fg"
                      }`}
                    >
                      {song.title}
                    </p>
                    <p className="block truncate text-[12px]/[16px] text-subtle">
                      {song.artist}
                    </p>
                  </div>
                </div>

                <span className="flex items-center justify-end gap-1">
                  <span className="mr-1 text-[13px] tabular-nums text-subtle">
                    {formatTime(song.duration)}
                  </span>
                  <span className="hidden shrink-0 items-center group-hover:flex">
                    <button
                      type="button"
                      aria-label={`Move ${song.title} up`}
                      onClick={() => moveTrack(playlist.id, index, index - 1)}
                      disabled={index === 0}
                      className="cursor-pointer p-1 text-subtle transition-colors hover:text-fg disabled:opacity-30"
                    >
                      <MdArrowUpward size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${song.title} down`}
                      onClick={() => moveTrack(playlist.id, index, index + 1)}
                      disabled={index === tracks.length - 1}
                      className="cursor-pointer p-1 text-subtle transition-colors hover:text-fg disabled:opacity-30"
                    >
                      <MdArrowDownward size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${song.title}`}
                      onClick={() => removeTrack(playlist.id, song.trackId)}
                      className="cursor-pointer p-1 text-subtle transition-colors hover:text-danger"
                    >
                      <MdClose size={16} />
                    </button>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <PlaylistForm
          title="Edit playlist"
          initial={{
            name: playlist.name,
            description: playlist.description,
          }}
          onClose={() => setEditing(false)}
          onSubmit={(values) => {
            updatePlaylist(playlist.id, values);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
