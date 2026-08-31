import { useState } from "react";
import { MdAdd, MdDeleteOutline } from "react-icons/md";
import { PlaylistCard } from "../components/PlaylistCard";
import { PlaylistForm } from "../components/PlaylistForm";
import { usePlaylists } from "../context/PlaylistContext";

/** Playlist library: create, browse and delete playlists. */
export function PlaylistsPage() {
  const { playlists, createPlaylist, removePlaylist } = usePlaylists();
  const [creating, setCreating] = useState(false);

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl/[32px] font-bold text-fg">Playlists</h1>
          <p className="mt-1 text-[14px] text-subtle">
            {playlists.length} playlists in your library
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

      <div className="mt-6 flex flex-wrap gap-4">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="group relative">
            <PlaylistCard playlist={playlist} />
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
