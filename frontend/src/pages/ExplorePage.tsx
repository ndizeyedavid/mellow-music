import { Link } from "react-router-dom";
import { SectionSlider } from "../components/SectionSlider";
import { ForYouCard } from "../components/ForYouCard";
import { AlbumCard } from "../components/AlbumCard";
import { ArtistCard } from "../components/ArtistCard";
import { GenreCard } from "../components/GenreCard";
import { PlaylistCard } from "../components/PlaylistCard";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import {
  albums,
  artistById,
  artists,
  forYouCards,
  genres,
  songs,
} from "../data/library";

/** Discovery home: hero, trending tracks, releases, playlists, genres, artists. */
export function ExplorePage() {
  const { currentTrack, isPlaying, replaceQueue } = usePlayer();
  const { playlists } = usePlaylists();

  const trending = [...songs].sort((a, b) => b.popularity - a.popularity);
  const featuredArtists = artists.slice(0, 6);

  return (
    <div className="px-4 pt-6 md:px-6">
      <div className="mt-8 flex flex-col gap-10">
        <SectionSlider title="Made For You" gap="gap-6">
          {forYouCards.map((card) => (
            <ForYouCard key={card.title} {...card} />
          ))}
        </SectionSlider>

        {/* Trending now */}
        <section>
          <div className="flex items-center justify-between px-2 md:px-8">
            <h2 className="text-[18px]/[24px] font-semibold text-fg">
              Trending Now
            </h2>
            <Link
              to="/tracks"
              className="text-[13px]/[18px] font-medium text-subtle transition-colors hover:text-fg"
            >
              See all
            </Link>
          </div>
          <ul className="mt-2 px-2 md:px-4">
            {trending.slice(0, 5).map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                isCurrent={currentTrack.id === song.id}
                isPlaying={isPlaying}
                onPlay={() => replaceQueue(trending, index)}
                showPopularity
              />
            ))}
          </ul>
        </section>

        <SectionSlider title="New Releases" gap="gap-6">
          {albums.slice(0, 8).map((album) => (
            <AlbumCard
              key={album.id}
              to={`/album/${album.id}`}
              image={album.image}
              title={album.title}
              subtitle={artistById(album.artistId)?.name ?? ""}
            />
          ))}
        </SectionSlider>

        <SectionSlider title="Popular Playlists" gap="gap-6">
          {playlists.slice(0, 8).map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </SectionSlider>

        <SectionSlider title="Top Genres" gap="gap-4">
          {genres.map((genre) => (
            <GenreCard key={genre.name} genre={genre} />
          ))}
        </SectionSlider>

        <SectionSlider title="Featured Artists" gap="gap-4">
          {featuredArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </SectionSlider>
      </div>
    </div>
  );
}
