import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MdFavorite, MdFavoriteBorder, MdPlayArrow } from "react-icons/md";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { songById, songs } from "../data/library";

/** Song detail: lyrics, production credits, metrics and related songs. */
export function SongPage() {
  const { id = "" } = useParams();
  const song = songById(id);
  const { currentTrack, isPlaying, replaceQueue, togglePlay } = usePlayer();
  const [liked, setLiked] = useState(false);

  if (!song) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Song not found</p>
        <Link
          to="/tracks"
          className="mt-3 inline-block text-[14px] font-semibold text-accent hover:underline"
        >
          Back to tracks
        </Link>
      </div>
    );
  }

  const isCurrent = currentTrack.id === song.id;
  const related = songs
    .filter(
      (item) =>
        item.id !== song.id &&
        (item.artistId === song.artistId || item.genre === song.genre),
    )
    .slice(0, 6);

  return (
    <div className="px-6 pt-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <img
          src={song.image}
          alt={song.title}
          className="h-44 w-44 rounded-lg object-cover shadow-xl-dark md:h-56 md:w-56"
        />
        <div className="min-w-0">
          <p className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Song
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold md:text-5xl">
            {song.title}
          </h1>
          <p className="mt-3 text-[14px]/[20px] text-subtle">
            <Link
              to={`/artist/${song.artistId}`}
              className="font-semibold text-fg hover:text-accent"
            >
              {song.artist}
            </Link>{" "}
            •{" "}
            <Link
              to={`/album/${song.albumId}`}
              className="font-semibold text-fg hover:text-accent"
            >
              {song.album}
            </Link>{" "}
            • {song.releaseDate}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                isCurrent ? togglePlay() : replaceQueue([song], 0)
              }
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-fg text-[#171719] shadow-md-dark transition-transform hover:scale-105"
              aria-label={isCurrent && isPlaying ? "Pause" : "Play"}
            >
              <MdPlayArrow size={24} />
            </button>
            <button
              type="button"
              aria-label={liked ? "Remove from liked" : "Add to liked"}
              aria-pressed={liked}
              onClick={() => setLiked((value) => !value)}
              className={`cursor-pointer transition-transform hover:scale-110 ${
                liked ? "text-accent" : "text-fg hover:text-accent"
              }`}
            >
              {liked ? (
                <MdFavorite size={26} />
              ) : (
                <MdFavoriteBorder size={26} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Engagement metrics */}
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-elevated px-4 py-1.5 text-[12px]/[16px] font-medium text-fg">
          {song.plays} plays
        </span>
        <span className="rounded-full bg-elevated px-4 py-1.5 text-[12px]/[16px] font-medium text-fg">
          Popularity {song.popularity}/100
        </span>
        <span className="rounded-full bg-elevated px-4 py-1.5 text-[12px]/[16px] font-medium text-fg">
          {song.genre}
        </span>
        {song.explicit && (
          <span className="rounded-full bg-elevated px-4 py-1.5 text-[12px]/[16px] font-medium text-fg">
            Explicit
          </span>
        )}
      </div>

      {/* Lyrics */}
      <section className="mt-8 max-w-2xl">
        <h2 className="text-[18px]/[24px] font-semibold text-fg">Lyrics</h2>
        <div className="mt-3 rounded-2xl border border-border bg-elevated p-6">
          {song.lyrics.map((line, index) => (
            <p
              key={index}
              className={`py-0.5 text-[15px]/[24px] ${
                isCurrent ? "text-fg" : "text-fg/70"
              }`}
            >
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* Production credits */}
      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Writers
          </h3>
          <p className="mt-1 text-[14px]/[20px] text-fg">
            {song.credits.writers.join(", ")}
          </p>
        </div>
        <div>
          <h3 className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Producers
          </h3>
          <p className="mt-1 text-[14px]/[20px] text-fg">
            {song.credits.producers.join(", ")}
          </p>
        </div>
        <div>
          <h3 className="text-[12px]/[16px] font-semibold uppercase tracking-wide text-subtle">
            Label
          </h3>
          <p className="mt-1 text-[14px]/[20px] text-fg">
            {song.credits.label}
          </p>
          <p className="text-[12px]/[16px] text-subtle">
            Released {song.releaseDate}
          </p>
        </div>
      </section>

      {/* Related songs */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">
            More like this
          </h2>
          <ul className="mt-2">
            {related.map((item, index) => (
              <SongRow
                key={item.id}
                song={item}
                index={index}
                isCurrent={currentTrack.id === item.id}
                isPlaying={isPlaying}
                onPlay={() => replaceQueue(related, index)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
