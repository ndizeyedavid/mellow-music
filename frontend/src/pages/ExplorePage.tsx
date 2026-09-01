import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionSlider } from "../components/SectionSlider";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { ForYouCard } from "../components/ForYouCard";
import { AlbumCard } from "../components/AlbumCard";
import { ArtistCard } from "../components/ArtistCard";
import { GenreCard } from "../components/GenreCard";
import { PlaylistCard } from "../components/PlaylistCard";
import { SongRow } from "../components/SongRow";
import { PageLoader } from "../components/PageLoader";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import { useConnectivity } from "../context/ConnectivityContext";
import { getHome, toTrack, type BackendResult } from "../api/music";
import { cacheGet, cacheSet } from "../utils/localCache";
import type { Track } from "../data/types";
import {
  albums,
  artistById,
  artists,
  forYouCards,
  genres,
  songs,
} from "../data/library";

const HOME_CACHE_KEY = "home";

/** Discovery home: hero, backend trending, releases, playlists, genres, artists. */
export function ExplorePage() {
  useDocumentTitle("Home");
  const { currentTrack, isPlaying, playResults } = usePlayer();
  const { playlists } = usePlaylists();
  const { networkOnline, backendOnline } = useConnectivity();

  const [homeResults, setHomeResults] = useState<BackendResult[] | null>(null);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [usingCache, setUsingCache] = useState(false);

  // Load backend homepage results; fall back to the last good cache on failure.
  useEffect(() => {
    let cancelled = false;
    void getHome().then((results) => {
      if (cancelled) return;
      if (results && results.length) {
        cacheSet(HOME_CACHE_KEY, results);
        setHomeResults(results);
        setUsingCache(false);
      } else {
        const cached = cacheGet<BackendResult[]>(HOME_CACHE_KEY);
        setHomeResults(cached?.length ? cached : null);
        setUsingCache(cached?.length ? true : false);
      }
      setHomeLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [networkOnline, backendOnline]);

  const homeLoading = !homeLoaded;
  const localTrending: Track[] = [...songs].sort(
    (a, b) => b.popularity - a.popularity,
  );
  const trending: Track[] = homeResults?.length
    ? homeResults.map((result) => toTrack(result, "/demo.mp3"))
    : localTrending;
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
            <div className="flex items-center gap-4">
              {usingCache && (
                <span className="text-[12px]/[16px] font-medium text-subtle">
                  Cached results
                </span>
              )}
              <Link
                to="/tracks"
                className="text-[13px]/[18px] font-medium text-subtle transition-colors hover:text-fg"
              >
                See all
              </Link>
            </div>
          </div>
          {homeLoading ? (
            <div className="mt-2 px-2 md:px-4">
              <PageLoader />
            </div>
          ) : (
            <ul className="mt-2 px-2 md:px-4">
              {trending.slice(0, 5).map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={index}
                  isCurrent={currentTrack.id === song.id}
                  isPlaying={isPlaying}
                  onPlay={() => {
                    if (homeResults?.length) {
                      void playResults(homeResults, index);
                    } else {
                      // Backend offline — play the local catalog as a fallback.
                      void playResults(
                        localTrending.map((item) => ({
                          id: item.id,
                          title: item.title,
                          artist: item.artist,
                          thumbnail: item.image,
                          duration: item.duration,
                          url: "",
                        })),
                        index,
                      );
                    }
                  }}
                  showPopularity
                />
              ))}
            </ul>
          )}
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
