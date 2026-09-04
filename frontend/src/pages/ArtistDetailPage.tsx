import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MdPlayArrow, MdVerified } from "react-icons/md";
import { ApiAlbumCard } from "../components/ApiCards";
import { ApiTrackList } from "../components/ApiTrackList";
import { SafeImage } from "../components/SafeImage";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../context/LibraryContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { usePlayDiscovery } from "../hooks/usePlayDiscovery";
import {
  getArtist,
  type ApiAlbum,
  type ApiArtist,
  type ApiDiscoveryItem,
} from "../api/music";

/** Artist profile, live from GET /api/artist/{id}. */
export function ArtistDetailPage() {
  const { id = "" } = useParams();
  // Keyed so a fresh loading state starts per artist (no setState-in-effect).
  return <ArtistDetail key={id} id={id} />;
}

function ArtistDetail({ id }: { id: string }) {
  const [artist, setArtist] = useState<ApiArtist | null>(null);
  const [topTracks, setTopTracks] = useState<ApiDiscoveryItem[]>([]);
  const [albums, setAlbums] = useState<ApiAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(artist?.name);
  const { currentTrack, isPlaying } = usePlayer();
  const { isArtistFollowed, toggleFollowArtist } = useLibrary();
  const { playItems, isResolving, resolvingKey } = usePlayDiscovery();
  const following = isArtistFollowed(id);

  useEffect(() => {
    let cancelled = false;
    getArtist(id)
      .then((data) => {
        if (cancelled) return;
        setArtist(data.artist);
        setTopTracks(data.top_tracks);
        setAlbums(data.albums);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load artist.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="pb-4">
        <div className="h-64 animate-pulse bg-white/5 md:h-80" />
        <div className="px-6 pt-6 md:px-10">
          <div className="h-10 w-1/3 animate-pulse rounded bg-white/5" />
          <div className="mt-3 h-4 w-1/4 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="px-6 pt-6 text-center">
        <p className="text-[16px] font-medium text-fg">Artist not found</p>
        <p className="mt-1 text-[13px] text-subtle">{error}</p>
        <Link
          to="/"
          className="mt-3 inline-block text-[14px] font-semibold text-accent hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const fans =
    artist.fans > 0
      ? `${Intl.NumberFormat("en", { notation: "compact" }).format(artist.fans)} fans`
      : "";

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="relative h-64 md:h-80">
        <SafeImage
          src={artist.picture}
          alt={artist.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-10">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl/[48px] font-bold md:text-6xl/[64px]">
              {artist.name}
            </h1>
            <MdVerified
              size={28}
              className="text-[#3d91f4]"
              aria-label="Verified artist"
            />
          </div>
          <p className="mt-2 text-[13px]/[18px] text-fg/70">
            {[fans, artist.nb_albums ? `${artist.nb_albums} albums` : ""]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 md:px-10">
        <button
          type="button"
          onClick={() => topTracks.length > 0 && void playItems(topTracks, 0)}
          disabled={topTracks.length === 0 || resolvingKey !== null}
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
      {topTracks.length > 0 && (
        <section className="mt-8 px-6 md:px-10">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">Popular</h2>
          <ApiTrackList
            items={topTracks}
            currentTitle={currentTrack?.title}
            isPlaying={isPlaying}
            onPlay={(index) => void playItems(topTracks, index)}
            isResolvingItem={isResolving}
            resolvingActive={resolvingKey !== null}
            enableAdd
          />
        </section>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <section className="mt-8 px-6 md:px-10">
          <h2 className="text-[18px]/[24px] font-semibold text-fg">Albums</h2>
          <div className="no-scrollbar mt-4 flex gap-6 overflow-x-auto">
            {albums.map((album) => (
              <ApiAlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
