import { useCallback, useEffect, useState } from "react";
import { deleteOfflineSong, getAllOfflineSongs, getOfflineSong, offlineBlobUrl, saveOfflineSong, type OfflineSong } from "../utils/offlineDB";
import { fetchSongById, prepareSong } from "../api/music";
import type { Track } from "../types";

export function useOfflineSongs() {
  const [songs, setSongs] = useState<OfflineSong[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllOfflineSongs();
      setSongs(all.sort((a: OfflineSong, b: OfflineSong) => b.savedAt - a.savedAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { songs, loading, refresh };
}

export function useOfflineStatus(id: string) {
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getOfflineSong(id).then((song: OfflineSong | undefined) => {
      if (!cancelled) {
        setSaved(!!song);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { saved, checking };
}

/** Download a track's audio and save to IndexedDB. Resolves YouTube full audio via prepare/fetch, not Deezer preview. */
export async function downloadTrackForOffline(track: Track, onProgress?: (pct: number) => void): Promise<OfflineSong> {
  let audioUrl = track.source;
  let fetchId = track.id;

  // If track is not yet resolved (e.g. from discovery row), resolve via prepare/fetch
  if (!audioUrl) {
    const preparedId = await prepareSong(track.title);
    const fetched = await fetchSongById(preparedId);
    audioUrl = fetched.AUDIO_URL;
    fetchId = fetched.ID;
    if (!audioUrl) throw new Error("No audio available for offline save");
  }

  onProgress?.(10);
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const mimeType = res.headers.get("content-type") || "audio/mpeg";
  const blob = await res.blob();
  onProgress?.(90);

  const offline: OfflineSong = {
    id: fetchId,
    title: track.title,
    artist: track.artist,
    image: track.image,
    duration: track.duration,
    audioBlob: blob,
    mimeType,
    savedAt: Date.now(),
    size: blob.size,
  };
  await saveOfflineSong(offline);
  onProgress?.(100);
  return offline;
}

export async function removeOffline(id: string): Promise<void> {
  await deleteOfflineSong(id);
}

export function offlineToTrack(song: OfflineSong): Track & { blobUrl: string } {
  const url = offlineBlobUrl(song);
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    artistId: `offline-${song.artist}`,
    album: "Offline",
    albumId: "offline",
    image: song.image,
    source: url,
    duration: song.duration,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "Offline",
    lyrics: [],
    credits: { writers: [], producers: [], label: "" },
    blobUrl: url,
  };
}
