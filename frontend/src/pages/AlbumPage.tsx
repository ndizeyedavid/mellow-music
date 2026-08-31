import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MdFavorite,
  MdFavoriteBorder,
  MdPlayArrow,
  MdShuffle,
} from "react-icons/md";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { albumById, albumSongs, artistById } from "../data/library";
import { formatTime } from "../utils/format";

/** Album detail: artwork, release info, tracklist, save + playback controls. */
export function AlbumPage() {
  const { id = "" } = useParams();
  const album = albumById(id);
  const { currentTrack, isPlaying, replaceQueue } = usePlayer();
  const [saved, setSaved] = useState(false);

  if (!album) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Album not found</p>
        <Link
          to="/albums"
          className="mt-3 inline-block text-[14px] font-semibold text-accent hover:underline"
        >
          Back to albums
        </Link>
      </div>
    );
  }

  const artist = artistById(album.artistId);
  const tracks = albumSongs(album);
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);

  return (
    <div className="px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <img
          src={album.image}
          alt={album.title}
          className="h-44 w-44 rounded-lg object-cover shadow-xl-dark md:h-56 md:w-56"
        />
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Album
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {album.title}
          </h1>
          <p className="mt-3 line-clamp-3 max-w-xl text-[14px]/[20px] text-fg/70">
            {album.description}
          </p>
          <p className="mt-2 text-[13px]/[18px] text-subtle">
            <Link
              to={`/artist/${album.artistId}`}
              className="font-semibold text-fg hover:text-accent"
            >
              {artist?.name}
            </Link>{" "}
            • {album.year} • {tracks.length} songs • {formatTime(totalDuration)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => replaceQueue(tracks, 0)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
        >
          <MdPlayArrow size={20} /> Play
        </button>
        <button
          type="button"
          onClick={() => replaceQueue(shuffled, 0)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-elevated px-5 py-3 text-[14px]/[20px] font-semibold text-fg transition-colors hover:bg-white/10"
        >
          <MdShuffle size={18} /> Shuffle
        </button>
        <button
          type="button"
          aria-label={saved ? "Remove from library" : "Save to library"}
          aria-pressed={saved}
          onClick={() => setSaved((value) => !value)}
          className={`cursor-pointer transition-transform hover:scale-110 ${
            saved ? "text-accent" : "text-fg hover:text-accent"
          }`}
        >
          {saved ? <MdFavorite size={28} /> : <MdFavoriteBorder size={28} />}
        </button>
      </div>

      {/* Tracklist */}
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
            showPopularity
          />
        ))}
      </ul>
    </div>
  );
}
