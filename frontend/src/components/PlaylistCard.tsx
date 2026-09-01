import { Link } from "react-router-dom";
import { MdPlayArrow } from "react-icons/md";
import { SafeImage } from "./SafeImage";
import type { Playlist } from "../data/library";

/** Playlist card with hover play overlay and track count. */
export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      to={`/playlist/${playlist.id}`}
      className="group w-[200px] shrink-0 rounded-xl p-3 transition-colors hover:bg-white/5"
    >
      <div className="relative w-[176px]">
        <SafeImage
          src={playlist.image}
          alt={playlist.name}
          className="h-[176px] w-[176px] rounded-lg object-cover shadow-lg"
          loading="lazy"
        />
        <span className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-fg text-[#171719] opacity-0 shadow-md-dark transition-all duration-200 group-hover:opacity-100">
          <MdPlayArrow size={22} />
        </span>
      </div>
      <p className="mt-3 line-clamp-1 text-[14px]/[20px] font-semibold text-fg">
        {playlist.name}
      </p>
      <p className="line-clamp-2 text-[12px]/[16px] text-subtle">
        {playlist.trackIds.length} songs
      </p>
    </Link>
  );
}
