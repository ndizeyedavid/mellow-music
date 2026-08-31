import { Link } from "react-router-dom";
import type { Genre } from "../data/library";

/** Tinted genre tile used on the Explore page. */
export function GenreCard({ genre }: { genre: Genre }) {
  return (
    <Link
      to={`/tracks?genre=${encodeURIComponent(genre.name)}`}
      className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
    >
      <img
        src={genre.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        loading="lazy"
      />
      <span className="absolute left-3 top-3 text-[14px]/[18px] font-bold text-fg drop-shadow">
        {genre.name}
      </span>
    </Link>
  );
}
