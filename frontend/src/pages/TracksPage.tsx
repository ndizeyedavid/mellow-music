import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MdPlayArrow } from "react-icons/md";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { songs } from "../data/library";

type SortKey = "title" | "artist" | "duration" | "popularity";

const sortOptions: Array<{ id: SortKey; label: string }> = [
  { id: "popularity", label: "Popularity" },
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
  { id: "duration", label: "Duration" },
];

/** All-tracks library with sorting, filtering and bulk playback. */
export function TracksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const genre = searchParams.get("genre") ?? "";
  const { currentTrack, isPlaying, replaceQueue } = usePlayer();
  const [sortKey, setSortKey] = useState<SortKey>("popularity");
  const [query, setQuery] = useState("");

  const genres = useMemo(
    () => Array.from(new Set(songs.map((song) => song.genre))).sort(),
    [],
  );

  const visible = useMemo(() => {
    let list = songs.filter(
      (song) =>
        (genre ? song.genre === genre : true) &&
        (query
          ? song.title.toLowerCase().includes(query.toLowerCase()) ||
            song.artist.toLowerCase().includes(query.toLowerCase())
          : true),
    );
    switch (sortKey) {
      case "title":
        list = [...list].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "artist":
        list = [...list].sort((a, b) => a.artist.localeCompare(b.artist));
        break;
      case "duration":
        list = [...list].sort((a, b) => a.duration - b.duration);
        break;
      case "popularity":
        list = [...list].sort((a, b) => b.popularity - a.popularity);
        break;
    }
    return list;
  }, [genre, query, sortKey]);

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl/[32px] font-bold text-fg">Tracks</h1>
          <p className="mt-1 text-[14px] text-subtle">
            {visible.length} songs{genre ? ` in ${genre}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter tracks…"
            aria-label="Filter tracks"
            className="h-10 w-48 rounded-full border border-border bg-elevated px-4 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-accent/50"
          />
          <button
            type="button"
            onClick={() => replaceQueue(visible, 0)}
            disabled={visible.length === 0}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MdPlayArrow size={18} /> Play all
          </button>
        </div>
      </div>

      {/* Genre filter chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSearchParams({}, { replace: true })}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px]/[18px] font-semibold transition-colors ${
            !genre
              ? "bg-fg text-[#171719]"
              : "bg-elevated text-fg hover:bg-white/10"
          }`}
        >
          All
        </button>
        {genres.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSearchParams({ genre: item }, { replace: true })}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px]/[18px] font-semibold transition-colors ${
              genre === item
                ? "bg-fg text-[#171719]"
                : "bg-elevated text-fg hover:bg-white/10"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Sort controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-subtle">
          Sort by
        </span>
        {sortOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={sortKey === option.id}
            onClick={() => setSortKey(option.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px]/[18px] font-semibold transition-colors ${
              sortKey === option.id
                ? "bg-accent/15 text-accent"
                : "bg-elevated text-fg hover:bg-white/10"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Tracklist */}
      <ul className="mt-4">
        {visible.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            index={index}
            isCurrent={currentTrack.id === song.id}
            isPlaying={isPlaying}
            onPlay={() => replaceQueue(visible, index)}
            showPopularity
          />
        ))}
      </ul>
    </div>
  );
}
