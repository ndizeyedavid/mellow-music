import { api } from "./client";
import type { Track } from "../types";

/* ------------------------------------------------------------------ */
/* Backend shapes                                                      */
/* ------------------------------------------------------------------ */

/** Item returned by GET /api/home and GET /api/search. */
export interface ApiDiscoveryItem {
  id: string | null;
  title: string | null;
  artist: string | null;
  thumbnail: string | null;
  duration: number | null;
  url: string | null;
}

/** Response body of GET /api/fetch/{songID}. */
export interface ApiFetchSong {
  ID: string;
  SONG_NAME: string;
  YT_ID: string;
  SPOTIFY_ID: string;
  DURATION: number;
  AUDIO_URL: string;
  THUMBNAIL: string;
  EXPIRY: string;
  LYRICS: string;
  ERROR?: string;
}

/** Album card from GET /api/charts, /api/search/albums, /api/artist/{id}. */
export interface ApiAlbum {
  id: string;
  title: string;
  artist: string;
  artist_id: string;
  cover: string;
  nb_tracks: number;
  release_date?: string;
  label?: string;
}

/** Artist card from GET /api/charts, /api/search/artists. */
export interface ApiArtist {
  id: string;
  name: string;
  picture: string;
  fans: number;
  nb_albums?: number;
}

/** Playlist card from GET /api/charts, /api/search/playlists. */
export interface ApiPlaylist {
  id: string;
  title: string;
  picture: string;
  creator: string;
  nb_tracks: number;
  description?: string;
  fans?: number;
}

/** Genre from GET /api/genres. */
export interface ApiGenre {
  id: string;
  name: string;
  picture: string;
}

/** Payload of GET /api/charts. */
export interface ApiCharts {
  tracks: ApiDiscoveryItem[];
  albums: ApiAlbum[];
  artists: ApiArtist[];
  playlists: ApiPlaylist[];
}

/* ------------------------------------------------------------------ */
/* Raw endpoint calls                                                  */
/* ------------------------------------------------------------------ */

/** GET /api/search?q=... — generic search on the chosen engine. */
export async function searchApi(
  query: string,
  maxResults = 10,
  provider: string = "deezer",
): Promise<ApiDiscoveryItem[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await api.get<{ results: ApiDiscoveryItem[] }>("/api/search", {
    params: { q, max_results: maxResults, provider },
  });
  return data.results ?? [];
}

/** GET /api/charts — top tracks, albums, artists, playlists for Home. */
export async function getCharts(limit = 10): Promise<ApiCharts> {
  const { data } = await api.get<ApiCharts>("/api/charts", {
    params: { limit },
  });
  return {
    tracks: data.tracks ?? [],
    albums: data.albums ?? [],
    artists: data.artists ?? [],
    playlists: data.playlists ?? [],
  };
}

/** GET /api/genres — genre browse cards. */
export async function getGenres(): Promise<ApiGenre[]> {
  const { data } = await api.get<{ results: ApiGenre[] }>("/api/genres");
  return data.results ?? [];
}

/** GET /api/search/albums?q=... */
export async function searchAlbums(
  query: string,
  maxResults = 10,
): Promise<ApiAlbum[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await api.get<{ results: ApiAlbum[] }>(
    "/api/search/albums",
    { params: { q, max_results: maxResults } },
  );
  return data.results ?? [];
}

/** GET /api/search/artists?q=... */
export async function searchArtists(
  query: string,
  maxResults = 10,
): Promise<ApiArtist[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await api.get<{ results: ApiArtist[] }>(
    "/api/search/artists",
    { params: { q, max_results: maxResults } },
  );
  return data.results ?? [];
}

/** GET /api/search/playlists?q=... */
export async function searchPlaylists(
  query: string,
  maxResults = 10,
): Promise<ApiPlaylist[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await api.get<{ results: ApiPlaylist[] }>(
    "/api/search/playlists",
    { params: { q, max_results: maxResults } },
  );
  return data.results ?? [];
}

/** GET /api/album/{id} — album header + tracklist. */
export async function getAlbum(
  id: string,
): Promise<{ album: ApiAlbum; tracks: ApiDiscoveryItem[] }> {
  const { data } = await api.get<{
    album: ApiAlbum;
    tracks: ApiDiscoveryItem[];
    ERROR?: string;
  }>(`/api/album/${encodeURIComponent(id)}`);
  if (!data || data.ERROR || !data.album) {
    throw new Error(data?.ERROR || "Album not found.");
  }
  return { album: data.album, tracks: data.tracks ?? [] };
}

/** GET /api/artist/{id} — artist header + top tracks + albums. */
export async function getArtist(
  id: string,
): Promise<{
  artist: ApiArtist;
  top_tracks: ApiDiscoveryItem[];
  albums: ApiAlbum[];
}> {
  const { data } = await api.get<{
    artist: ApiArtist;
    top_tracks: ApiDiscoveryItem[];
    albums: ApiAlbum[];
    ERROR?: string;
  }>(`/api/artist/${encodeURIComponent(id)}`);
  if (!data || data.ERROR || !data.artist) {
    throw new Error(data?.ERROR || "Artist not found.");
  }
  return {
    artist: data.artist,
    top_tracks: data.top_tracks ?? [],
    albums: data.albums ?? [],
  };
}

/** GET /api/playlist/{id} — curated playlist header + tracklist. */
export async function getPlaylist(
  id: string,
): Promise<{ playlist: ApiPlaylist; tracks: ApiDiscoveryItem[] }> {
  const { data } = await api.get<{
    playlist: ApiPlaylist;
    tracks: ApiDiscoveryItem[];
    ERROR?: string;
  }>(`/api/playlist/${encodeURIComponent(id)}`);
  if (!data || data.ERROR || !data.playlist) {
    throw new Error(data?.ERROR || "Playlist not found.");
  }
  return { playlist: data.playlist, tracks: data.tracks ?? [] };
}

/** One mix track: discovery shape plus the curator's one-line reason. */
export interface MixTrack extends ApiDiscoveryItem {
  reason: string;
}

/** Payload of GET /api/mix. */
export interface MixResponse {
  mix_id: string;
  name: string;
  blurb: string;
  tracks: MixTrack[];
  curated: boolean;
}

/**
 * GET /api/mix — taste-driven mix. Artists/exclude come from buildTaste().
 * Empty taste returns chart fallback (cold start, no LLM spend).
 * fresh=true forces full re-curation past the backend cache.
 */
export async function getMix(
  artists: string[],
  exclude: string[],
  limit = 12,
  fresh = false,
): Promise<MixResponse> {
  const { data } = await api.get<MixResponse>("/api/mix", {
    params: {
      artists: artists.join(","),
      exclude: exclude.join(","),
      limit,
      ...(fresh ? { fresh: true } : {}),
    },
  });
  return {
    mix_id: data.mix_id ?? "",
    name: data.name ?? "My Mix",
    blurb: data.blurb ?? "",
    tracks: data.tracks ?? [],
    curated: data.curated ?? false,
  };
}

/**
 * GET /api/prepare/{string} — prepare a song by title (or URL) and get its ID.
 * The title usually comes from a home/search result.
 *
 * Results are cached (IDs are stable via DB aliases) and concurrent
 * identical requests share one in-flight promise — replaying a song or
 * double-mounting in dev never hits the backend twice.
 */
const prepareCache = new Map<string, { id: string; at: number }>();
const prepareInflight = new Map<string, Promise<string>>();
const PREPARE_TTL_MS = 30 * 60 * 1000;

export async function prepareSong(title: string): Promise<string> {
  const label = title.trim();
  if (!label) throw new Error("Cannot prepare an empty song title.");
  const key = label.toLowerCase();
  const cached = prepareCache.get(key);
  if (cached && Date.now() - cached.at < PREPARE_TTL_MS) return cached.id;
  const inflight = prepareInflight.get(key);
  if (inflight) return inflight;
  const request = (async () => {
    const { data } = await api.get<{ ID: string }>(
      `/api/prepare/${encodeURIComponent(label)}`,
    );
    if (!data?.ID) throw new Error(`Could not prepare "${label}".`);
    prepareCache.set(key, { id: data.ID, at: Date.now() });
    return data.ID;
  })();
  prepareInflight.set(key, request);
  try {
    return await request;
  } finally {
    prepareInflight.delete(key);
  }
}

/**
 * GET /api/fetch/{songID} — full song metadata including AUDIO_URL.
 * Cached until the song's own EXPIRY (or 4h max); concurrent identical
 * requests share one in-flight promise.
 */
const fetchCache = new Map<string, { song: ApiFetchSong; at: number }>();
const fetchInflight = new Map<string, Promise<ApiFetchSong>>();
const FETCH_TTL_MS = 4 * 3600 * 1000;

function isFetchFresh(song: ApiFetchSong, cachedAt: number): boolean {
  if (Date.now() - cachedAt >= FETCH_TTL_MS) return false;
  const expiry = new Date(song.EXPIRY).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

export async function fetchSongById(songID: string): Promise<ApiFetchSong> {
  const cached = fetchCache.get(songID);
  if (cached && isFetchFresh(cached.song, cached.at)) return cached.song;
  const inflight = fetchInflight.get(songID);
  if (inflight) return inflight;
  const request = (async () => {
    const { data } = await api.get<ApiFetchSong>(
      `/api/fetch/${encodeURIComponent(songID)}`,
    );
    if (!data || data.ERROR || !data.AUDIO_URL) {
      throw new Error(data?.ERROR || "Song not found.");
    }
    fetchCache.set(songID, { song: data, at: Date.now() });
    return data;
  })();
  fetchInflight.set(songID, request);
  try {
    return await request;
  } finally {
    fetchInflight.delete(songID);
  }
}

/* ------------------------------------------------------------------ */
/* Playback helpers (prepare -> fetch -> AUDIO_URL)                    */
/*                                                                     */
/* NOTE: /api/audio/{songID} is intentionally NOT used — it is buggy.  */
/* The <audio> element plays fetchSongById(...).AUDIO_URL directly.     */
/* ------------------------------------------------------------------ */

/** Resolve a discovery item (home/search) into a playable Track. */
export async function resolveDiscoveryItem(
  item: ApiDiscoveryItem,
): Promise<Track> {
  const title = (item.title ?? "").trim() || "Unknown title";
  const id = await prepareSong(title);
  return resolveSongId(id, item);
}

/** Resolve an already-prepared song ID into a playable Track. */
export async function resolveSongId(
  songID: string,
  fallback?: ApiDiscoveryItem,
): Promise<Track> {
  const song = await fetchSongById(songID);
  return fetchToTrack(song, fallback);
}

/* ------------------------------------------------------------------ */
/* Mapping to the frontend Track model                                 */
/* ------------------------------------------------------------------ */

/** Convert a fetched song (with AUDIO_URL) to a playable Track. */
export function fetchToTrack(
  song: ApiFetchSong,
  fallback?: ApiDiscoveryItem,
): Track {
  const title = song.SONG_NAME?.trim() || fallback?.title || "Unknown title";
  const fallbackArtist = fallback?.artist?.trim() || "";
  const artist =
    fallbackArtist ||
    (title.includes(" - ") ? title.split(" - ")[0].trim() : "") ||
    "Unknown artist";
  const lyrics =
    song.LYRICS && song.LYRICS !== "No Lyrics LOL :)"
      ? song.LYRICS.split("\n")
      : [];
  // Artwork priority: the Deezer cover the user actually clicked beats the
  // YouTube thumbnail, which is kept as the ambient fullscreen backdrop.
  const deezerArt = fallback?.thumbnail?.trim() || "";
  return {
    id: song.ID,
    title,
    artist,
    artistId: `api-artist-${artist}`,
    album: "Mellow Discovery",
    albumId: "api-discovery",
    image: deezerArt || song.THUMBNAIL || "",
    backdrop: song.THUMBNAIL || null,
    // Played directly by the <audio> element — never via /api/audio.
    source: song.AUDIO_URL,
    duration: typeof song.DURATION === "number" ? song.DURATION : 0,
    expiresAt: song.EXPIRY || null,
    popularity: 50,
    plays: "",
    releaseDate: "",
    genre: "Discovery",
    lyrics,
    credits: { writers: [], producers: [], label: "" },
  };
}
