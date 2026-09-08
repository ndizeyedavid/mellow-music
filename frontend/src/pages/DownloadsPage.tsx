import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdCloudDownload, MdDelete, MdPlayArrow } from "react-icons/md";
import { EmptyState } from "../components/EmptyState";
import { SafeImage } from "../components/SafeImage";
import { usePlayer } from "../context/PlayerContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { getAllOfflineSongs, deleteOfflineSong, offlineBlobUrl, type OfflineSong } from "../utils/offlineDB";
import { formatTime } from "../utils/format";

export function DownloadsPage() {
  useDocumentTitle("Downloads");
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const { replaceQueue } = usePlayer();
  const [songs, setSongs] = useState<OfflineSong[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const all = await getAllOfflineSongs();
    setSongs(all.sort((a, b) => b.savedAt - a.savedAt));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Offline takes you here: when the network drops, any page redirects to downloads
  // (handled globally in AppShell, this page just renders the filtered view).
  const play = (index: number) => {
    const urls: string[] = [];
    const tracks = songs.map((s) => {
      const url = offlineBlobUrl(s);
      urls.push(url);
      return {
        id: s.id,
        title: s.title,
        artist: s.artist,
        artistId: `offline-${s.artist}`,
        album: "Offline",
        albumId: "offline",
        image: s.image,
        source: url,
        duration: s.duration,
        popularity: 50,
        plays: "",
        releaseDate: "",
        genre: "Offline",
        lyrics: [],
        credits: { writers: [], producers: [], label: "" },
        // keep blob URLs to revoke later if needed
        _blobUrls: urls,
      };
    });
    // Use any offline track's blob URL - they are all pre-created
    replaceQueue(tracks as never, index);
  };

  if (loading) {
    return (
      <div className="px-6 pt-6">
        <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 animate-pulse rounded-md bg-white/5" />
              <div className="flex-1">
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl/[32px] font-bold text-fg">
            <MdCloudDownload size={24} className="text-accent" /> Downloads
          </h1>
          <p className="mt-1 text-[14px] text-subtle">
            {songs.length === 0
              ? "No offline songs yet"
              : `${songs.length} song${songs.length === 1 ? "" : "s"} available offline`}
            {!online && " — you're offline, only downloads are shown"}
          </p>
        </div>
        {!online && (
          <span className="rounded-full bg-amber-500 px-3 py-1 text-[12px] font-bold text-black">Offline mode</span>
        )}
      </div>

      {songs.length === 0 ? (
        <EmptyState
          title="No downloads yet"
          description="Save songs for offline from any track's download button or the now-playing menu. They'll appear here and play without internet, just like YouTube offline."
          action={
            <Link
              to="/"
              className="inline-block rounded-full bg-fg px-5 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
            >
              Discover music
            </Link>
          }
        />
      ) : (
        <ul className="mt-6">
          {songs.map((song, index) => (
            <li
              key={song.id}
              className="group grid grid-cols-[2.5rem_minmax(0,1fr)_6rem] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
            >
              <span className="flex w-10 justify-center">
                <span className="text-[14px] tabular-nums text-subtle group-hover:hidden">{index + 1}</span>
                <button
                  type="button"
                  aria-label={`Play ${song.title} offline`}
                  onClick={() => play(index)}
                  className="hidden cursor-pointer text-fg hover:text-accent group-hover:block"
                >
                  <MdPlayArrow size={18} />
                </button>
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <SafeImage src={song.image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                <div className="min-w-0">
                  <p className="block truncate text-[14px]/[20px] font-semibold text-fg">{song.title}</p>
                  <p className="block truncate text-[12px]/[16px] text-subtle">{song.artist}</p>
                </div>
              </div>
              <span className="flex items-center justify-end gap-2 text-right text-[13px] tabular-nums text-subtle">
                {formatTime(song.duration)}
                <button
                  type="button"
                  aria-label={`Remove ${song.title} from offline`}
                  onClick={async () => {
                    await deleteOfflineSong(song.id);
                    await refresh();
                  }}
                  className="hidden cursor-pointer rounded-full p-1.5 text-subtle hover:text-danger group-hover:block"
                >
                  <MdDelete size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!online && songs.length > 0 && (
        <p className="mt-6 text-center text-[13px] text-subtle">
          Online features will return when you reconnect.{" "}
          <button type="button" onClick={() => navigate("/")} className="font-semibold text-fg hover:text-accent">
            Go home
          </button>
        </p>
      )}
    </div>
  );
}
