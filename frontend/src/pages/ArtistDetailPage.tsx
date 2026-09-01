import { Link, useParams } from "react-router-dom";
import { MdPlayArrow, MdVerified } from "react-icons/md";
import { SongRow } from "../components/SongRow";
import { AlbumCard } from "../components/AlbumCard";
import { ArtistCard } from "../components/ArtistCard";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { albumById, albums, artistById, artists, songs } from "../data/library";

/** Artist profile: hero, verified badge, popular tracks, albums, related artists. */
export function ArtistDetailPage() {
  const { id = "" } = useParams();
  const artist = artistById(id);
  const { currentTrack, isPlaying, replaceQueue } = usePlayer();
  const { isArtistFollowed, toggleFollowArtist } = useLibrary();
  useDocumentTitle(artist?.name);
  const following = isArtistFollowed(id);

  if (!artist) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Artist not found</p>
        <Link
          to="/artists"
          className="mt-3 inline-block text-[14px] font-semibold text-accent hover:underline"
        >
          Back to artists
        </Link>
      </div>
    );
  }

  const topSongs = songs
    .filter((song) => song.artistId === artist.id)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 5);
  const topAlbums = albums.filter((album) => album.artistId === artist.id);
  const related = artists.filter((item) => artist.relatedIds.includes(item.id));

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="relative h-64 md:h-80">
        <img
          src={artist.image}
          alt={artist.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-10">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl/[48px] font-bold md:text-6xl/[64px]">
              {artist.name}
            </h1>
            {artist.verified && (
              <MdVerified
                size={28}
                className="text-[#3d91f4]"
                aria-label="Verified artist"
              />
            )}
          </div>
          <p className="mt-2 text-[13px]/[18px] text-fg/70">
            {artist.monthlyListeners} monthly listeners • {artist.followers}{" "}
            followers
          </p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 md:px-10">
        <button
          type="button"
          onClick={() => replaceQueue(topSongs, 0)}
          disabled={topSongs.length === 0}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fg px-6 py-3 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MdPlayArrow size={20} /> Play
        </button>
        <button
          type="button"
          aria-pressed={following}
          onClick={() => toggleFollowArtist(artist.id)}
          className={`cursor-pointer rounded-full px-6 py-3 text-[14px]/[20px] font-semibold transition-colors ${
            following
              ? "bg-fg text-[#171719] hover:bg-white/80"
              : "border border-border bg-elevated text-fg hover:bg-white/10"
          }`}
        >
          {following ? "Following" : "Follow"}
        </button>
      </div>

      {/* Popular tracks */}
      <section className="mt-8 px-6 md:px-10">
        <h2 className="text-[18px]/[24px] font-semibold text-fg">Popular</h2>
        <ul className="mt-2">
          {topSongs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              isCurrent={currentTrack.id === song.id}
              isPlaying={isPlaying}
              onPlay={() => replaceQueue(topSongs, index)}
              showAlbum={false}
            />
          ))}
        </ul>
      </section>

      {/* Top albums */}
      <section className="mt-8 px-6 md:px-10">
        <h2 className="text-[18px]/[24px] font-semibold text-fg">Albums</h2>
        <div className="no-scrollbar mt-4 flex gap-6 overflow-x-auto">
          {topAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              to={`/album/${album.id}`}
              image={album.image}
              title={album.title}
              subtitle={albumById(album.id)?.label ?? `${album.year}`}
            />
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mt-8 max-w-2xl px-6 md:px-10">
        <h2 className="text-[18px]/[24px] font-semibold text-fg">About</h2>
        <p className="mt-2 text-[14px]/[22px] text-fg/70">{artist.bio}</p>
      </section>

      {/* Related artists */}
      {related.length > 0 && (
        <section className="mt-8 px-6 md:px-10">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">
            Fans also like
          </h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {related.map((item) => (
              <ArtistCard key={item.id} artist={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
