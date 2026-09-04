import { Link } from "react-router-dom";
import { MdPlayArrow } from "react-icons/md";
import { SafeImage } from "./SafeImage";
import type {
  ApiAlbum,
  ApiArtist,
  ApiDiscoveryItem,
  ApiGenre,
  ApiPlaylist,
} from "../api/music";
import { formatTime } from "../utils/format";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function HoverPlay({
  label,
  loading,
  disabled,
  onPlay,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPlay();
      }}
      disabled={disabled}
      aria-label={loading ? `Loading ${label}` : `Play ${label}`}
      className="absolute bottom-3 right-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-fg text-[#171719] opacity-0 shadow-md-dark transition-all duration-200 group-hover:opacity-100 hover:scale-105 disabled:cursor-wait disabled:opacity-100"
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-[#171719]/20 border-t-[#171719]"
          role="status"
          aria-label="Loading"
        />
      ) : (
        <MdPlayArrow size={22} />
      )}
    </button>
  );
}

function CardShell({
  to,
  children,
  wide = false,
}: {
  to: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group shrink-0 rounded-xl p-3 transition-colors hover:bg-white/5 ${
        wide ? "w-[200px]" : "w-40"
      }`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Track card (top charts / discovery grid)                            */
/* ------------------------------------------------------------------ */

export function ApiTrackCard({
  item,
  index,
  items,
  onPlay,
  resolving,
  disabled,
}: {
  item: ApiDiscoveryItem;
  index: number;
  items: ApiDiscoveryItem[];
  onPlay: (items: ApiDiscoveryItem[], index: number) => void;
  resolving?: boolean;
  disabled?: boolean;
}) {
  const title = item.title?.trim() || "Unknown title";
  const artist = item.artist?.trim() || "Unknown artist";
  return (
    <article className="group w-40 shrink-0 rounded-xl p-3 transition-colors hover:bg-white/5">
      <div className="relative w-[136px]">
        <SafeImage
          src={item.thumbnail ?? ""}
          alt={title}
          className="h-[136px] w-[136px] rounded-lg object-cover shadow-lg"
          loading="lazy"
        />
        <HoverPlay
          label={title}
          loading={resolving}
          disabled={disabled}
          onPlay={() => onPlay(items, index)}
        />
      </div>
      <p className="mt-3 line-clamp-1 text-[14px]/[20px] font-semibold text-fg">
        <Link
          to={`/song/${encodeURIComponent(title)}`}
          className="transition-colors hover:text-accent"
        >
          {title}
        </Link>
      </p>
      <p className="line-clamp-1 text-[12px]/[16px] text-subtle">
        {artist}
        {typeof item.duration === "number" && item.duration > 0
          ? ` • ${formatTime(item.duration)}`
          : ""}
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Album card                                                          */
/* ------------------------------------------------------------------ */

export function ApiAlbumCard({ album }: { album: ApiAlbum }) {
  return (
    <CardShell to={`/album/${album.id}`} wide>
      <div className="relative w-[176px]">
        <SafeImage
          src={album.cover}
          alt={album.title}
          className="h-[176px] w-[176px] rounded-lg object-cover shadow-lg"
          loading="lazy"
        />
      </div>
      <p className="mt-3 line-clamp-1 text-[14px]/[20px] font-semibold text-fg">
        {album.title}
      </p>
      <p className="line-clamp-1 text-[12px]/[16px] text-subtle">
        {album.artist}
        {album.nb_tracks > 0 ? ` • ${album.nb_tracks} songs` : ""}
      </p>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Artist card                                                         */
/* ------------------------------------------------------------------ */

export function ApiArtistCard({ artist }: { artist: ApiArtist }) {
  const fans =
    artist.fans > 0
      ? `${Intl.NumberFormat("en", { notation: "compact" }).format(artist.fans)} fans`
      : "Artist";
  return (
    <CardShell to={`/artist/${artist.id}`}>
      <div className="relative mx-auto w-32">
        <SafeImage
          src={artist.picture}
          alt={artist.name}
          className="h-32 w-32 rounded-full object-cover shadow-lg transition-transform group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <p className="mt-3 truncate text-center text-[14px]/[20px] font-semibold text-fg">
        {artist.name}
      </p>
      <p className="truncate text-center text-[12px]/[16px] text-subtle">
        {fans}
      </p>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Playlist card (curated)                                             */
/* ------------------------------------------------------------------ */

export function ApiPlaylistCard({ playlist }: { playlist: ApiPlaylist }) {
  return (
    <CardShell to={`/playlist/${playlist.id}`} wide>
      <div className="relative w-[176px]">
        <SafeImage
          src={playlist.picture}
          alt={playlist.title}
          className="h-[176px] w-[176px] rounded-lg object-cover shadow-lg"
          loading="lazy"
        />
      </div>
      <p className="mt-3 line-clamp-1 text-[14px]/[20px] font-semibold text-fg">
        {playlist.title}
      </p>
      <p className="line-clamp-2 text-[12px]/[16px] text-subtle">
        {playlist.nb_tracks > 0 ? `${playlist.nb_tracks} songs` : "Playlist"}
        {playlist.creator ? ` • ${playlist.creator}` : ""}
      </p>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Genre tile                                                          */
/* ------------------------------------------------------------------ */

export function ApiGenreCard({ genre }: { genre: ApiGenre }) {
  return (
    <Link
      to={`/search?q=${encodeURIComponent(genre.name)}`}
      className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
    >
      <SafeImage
        src={genre.picture}
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
