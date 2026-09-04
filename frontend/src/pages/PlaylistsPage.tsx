import { useState } from "react";
import { Link } from "react-router-dom";
import { MdAdd, MdDeleteOutline } from "react-icons/md";
import { PlaylistForm } from "../components/PlaylistForm";
import { SafeImage } from "../components/SafeImage";
import { EmptyState } from "../components/EmptyState";
import {
  playlistCover,
} from "../utils/playlists";
import { usePlaylists } from "../context/PlaylistContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/** Your playlists: create, browse and delete (localStorage v2). */
export function PlaylistsPage() {
  useDocumentTitle("Playlists");
  const { playlists, createPlaylist, removePlaylist } = usePlaylists();
  const [creating, setCreating] = useState(false);

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl/[32px] font-bold text-fg">Your Playlists</h1>
          <p className="mt-1 text-[14px] text-subtle">
            {playlists.length === 0
              ? "Nothing here yet"
              : `${playlists.length} playlist${playlists.length === 1 ? "" : "s"} in your library`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
        >
          <MdAdd size={18} /> New playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <EmptyState
          title="No playlists yet"
          description="Create one, then add songs from anywhere with the + button."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="cursor-pointer rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Create playlist
            </button>
          }
        />
      ) : (
        <div className="mt-6 flex flex-wrap gap-4">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="group relative">
              <Link
                to={`/playlist/${playlist.id}`}
                className="block w-[200px] shrink-0 rounded-xl p-3 transition-colors hover:bg-white/5"
              >
                <SafeImage
                  src={playlistCover(playlist)}
                  alt={playlist.name}
                  className="h-[176px] w-[176px] rounded-lg object-cover shadow-lg"
                  loading="lazy"
                />
                <p className="mt-3 line-clamp-1 text-[14px]/[20px] font-semibold text-fg">
                  {playlist.name}
                </p>
                <p className="line-clamp-1 text-[12px]/[16px] text-subtle">
                  {playlist.tracks.length} song
                  {playlist.tracks.length === 1 ? "" : "s"}
                </p>
              </Link>
              <button
                type="button"
                aria-label={`Delete ${playlist.name}`}
                onClick={() => removePlaylist(playlist.id)}
                className="absolute right-4 top-4 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#171719]/80 text-fg/70 transition-colors hover:text-danger group-hover:flex"
              >
                <MdDeleteOutline size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <PlaylistForm
          title="New playlist"
          onClose={() => setCreating(false)}
          onSubmit={(values) => {
            createPlaylist(values);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
