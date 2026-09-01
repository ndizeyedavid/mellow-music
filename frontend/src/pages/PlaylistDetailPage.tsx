import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MdArrowDownward,
  MdArrowUpward,
  MdClose,
  MdDeleteOutline,
  MdEdit,
  MdPlayArrow,
} from "react-icons/md";
import { SongRow } from "../components/SongRow";
import { EmptyState } from "../components/EmptyState";
import { PlaylistForm } from "../components/PlaylistForm";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { playlistSongs } from "../data/library";
import { formatTime } from "../utils/format";

/** Playlist detail: metadata, play controls, track reordering and removal. */
export function PlaylistDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { playlists, updatePlaylist, removePlaylist } = usePlaylists();
  const { currentTrack, isPlaying, replaceQueue } = usePlayer();
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

  const tracks = playlistSongs(playlist);
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);

  const moveTrack = (index: number, delta: number) => {
    const next = [...tracks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updatePlaylist(playlist.id, {
      trackIds: next.map((track) => track.id),
    });
  };

  const removeTrack = (index: number) => {
    updatePlaylist(playlist.id, {
      trackIds: tracks.filter((_, i) => i !== index).map((track) => track.id),
    });
  };

  return (
    <div className="px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <img
          src={playlist.image}
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
          onClick={() => replaceQueue(tracks, 0)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={tracks.length === 0}
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
      {tracks.length === 0 ? (
        <EmptyState
          title="This playlist is empty"
          description="Add some songs from the Tracks page."
          action={
            <button
              type="button"
              onClick={() => navigate("/tracks")}
              className="cursor-pointer rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Browse tracks
            </button>
          }
        />
      ) : (
        <ul className="mt-6">
          {tracks.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              isCurrent={currentTrack.id === song.id}
              isPlaying={isPlaying}
              onPlay={() => replaceQueue(tracks, index)}
              showAlbum={false}
              actions={
                <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                  <button
                    type="button"
                    aria-label={`Move ${song.title} up`}
                    onClick={() => moveTrack(index, -1)}
                    disabled={index === 0}
                    className="cursor-pointer p-1 text-subtle transition-colors hover:text-fg disabled:opacity-30"
                  >
                    <MdArrowUpward size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${song.title} down`}
                    onClick={() => moveTrack(index, 1)}
                    disabled={index === tracks.length - 1}
                    className="cursor-pointer p-1 text-subtle transition-colors hover:text-fg disabled:opacity-30"
                  >
                    <MdArrowDownward size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${song.title}`}
                    onClick={() => removeTrack(index)}
                    className="cursor-pointer p-1 text-subtle transition-colors hover:text-danger"
                  >
                    <MdClose size={16} />
                  </button>
                </span>
              }
            />
          ))}
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
