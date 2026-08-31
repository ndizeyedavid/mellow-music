import { Link } from "react-router-dom";
import { MdVerified } from "react-icons/md";
import type { Artist } from "../data/library";

/** Circular artist card with name and follower count. */
export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link
      to={`/artist/${artist.id}`}
      className="group w-40 shrink-0 rounded-xl p-3 text-center transition-colors hover:bg-white/5"
    >
      <div className="relative mx-auto w-32">
        <img
          src={artist.image}
          alt={artist.name}
          className="h-32 w-32 rounded-full object-cover shadow-lg transition-transform group-hover:scale-[1.03]"
          loading="lazy"
        />
        {artist.verified && (
          <MdVerified
            size={24}
            className="absolute bottom-1 right-1 text-[#3d91f4]"
            aria-label="Verified artist"
          />
        )}
      </div>
      <p className="mt-3 truncate text-[14px]/[20px] font-semibold text-fg">
        {artist.name}
      </p>
      <p className="truncate text-[12px]/[16px] text-subtle">
        {artist.followers} followers
      </p>
    </Link>
  );
}
