import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def _load_env_file(path: str) -> None:
    """
    Minimal .env loader (no third-party dependency): KEY=VALUE lines with
    # comments and optional quotes. Shell exports always win — values are
    # only filled in when missing, so this is restart-safe and side-effect
    free for already-configured environments.
    """
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        pass


_load_env_file(os.path.join(os.path.dirname(BACKEND_DIR), ".env"))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from customisedLogs import CustomisedLogs

from Classes.Processors.DBHolder import DBHolder
from Classes.Processors.URLHandler import URLHandler
from Classes.Processors.SongProcessor import SongCache
from Classes.Processors.MixCurator import MixCurator
from Hidden.Secrets import CoreValues


app = FastAPI(
    title="Mellow Music API",
    description="Community-first music backend with search, prepare, fetch, and streaming endpoints.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Logger = CustomisedLogs()
SQLConn = DBHolder(Logger)
URLHandler = URLHandler()
SongCache = SongCache(SQLConn.useDB(), Logger, URLHandler)
Curator = MixCurator(Logger)


# Direct axios access from the frontend dev server (no Vite proxy).
# Browsers enforce CORS on cross-origin XHR, so the API must allow the
# web origins explicitly. Permissive in dev; tighten allow_origins in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


def _yt_result_to_json(item: dict) -> dict:
    if not item:
        return {}
    return {
        "id": item.get("id"),
        "title": item.get("title"),
        "artist": item.get("artist"),
        "thumbnail": item.get("thumbnail"),
        "duration": item.get("duration"),
        "url": item.get("url"),
    }


@app.get("/")
def root() -> dict:
    return {
        "name": CoreValues.appName,
        "message": "Mellow Music API is running.",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/prepare/{string:path}")
def _prepareAPI(string: str) -> dict:
    newID = SongCache.get_song_id(string)
    return {"ID": newID}


@app.get("/api/fetch/{songID}")
def _fetchAPI(songID: str) -> dict:
    try:
        song = SongCache.get_song_data(songID)
    except Exception as exc:
        return {"ERROR": f"Fetch failed: {exc}"}
    if song is None:
        return {"ERROR": "Song not found"}
    if getattr(song, "error", None):
        return {"ERROR": song.error}
    return song.full_dict()


@app.get("/api/audio/{songID}")
def _fetchAudio(songID: str):
    try:
        song = SongCache.get_song_data(songID)
    except Exception as exc:
        return {"ERROR": f"Fetch failed: {exc}"}
    if song is None:
        return {"ERROR": "Song not found"}
    if getattr(song, "error", None) or not song.audio_url:
        return {"ERROR": getattr(song, "error", None) or "No audio available"}
    return StreamingResponse(song.fetch_data_from_stream(), media_type="audio/mpeg")


@app.get("/api/home")
def _homeAPI() -> dict:
    results = SongCache.YTDLP.homepage(max_results_per_query=3, max_total=12, cache_ttl_seconds=300)
    return {"results": [_yt_result_to_json(item) for item in results]}


@app.get("/api/charts")
def _chartsAPI(limit: int = Query(10, ge=1, le=20)) -> dict:
    """Deezer charts: top tracks, albums, artists and playlists for the home page."""
    return SongCache.YTDLP.charts(limit=limit)


@app.get("/api/genres")
def _genresAPI() -> dict:
    """Genre list for browse cards."""
    return {"results": SongCache.YTDLP.genres()}


@app.get("/api/search/albums")
def _searchAlbumsAPI(q: str = Query(..., description="Search query string"), max_results: int = Query(10, ge=1, le=20)) -> dict:
    return {"results": SongCache.YTDLP.search_collection("album", q, max_results=max_results)}


@app.get("/api/search/artists")
def _searchArtistsAPI(q: str = Query(..., description="Search query string"), max_results: int = Query(10, ge=1, le=20)) -> dict:
    return {"results": SongCache.YTDLP.search_collection("artist", q, max_results=max_results)}


@app.get("/api/search/playlists")
def _searchPlaylistsAPI(q: str = Query(..., description="Search query string"), max_results: int = Query(10, ge=1, le=20)) -> dict:
    return {"results": SongCache.YTDLP.search_collection("playlist", q, max_results=max_results)}


@app.get("/api/album/{album_id}")
def _albumAPI(album_id: str) -> dict:
    details = SongCache.YTDLP.album_details(album_id)
    if details is None:
        return {"ERROR": "Album not found"}
    return details


@app.get("/api/artist/{artist_id}")
def _artistAPI(artist_id: str) -> dict:
    details = SongCache.YTDLP.artist_details(artist_id)
    if details is None:
        return {"ERROR": "Artist not found"}
    return details


@app.get("/api/playlist/{playlist_id}")
def _playlistAPI(playlist_id: str) -> dict:
    details = SongCache.YTDLP.playlist_details(playlist_id)
    if details is None:
        return {"ERROR": "Playlist not found"}
    return details


@app.get("/api/mix")
def _mixAPI(
    artists: str = Query("", description="Comma-separated artist names from user taste"),
    genres: str = Query("", description="Comma-separated genre names from user taste"),
    exclude: str = Query("", description="Comma-separated titles the user already knows"),
    limit: int = Query(12, ge=1, le=20),
    fresh: bool = Query(False, description="Bypass caches for a full re-curation"),
) -> dict:
    """
    Taste-driven mix. Deterministic candidate pool for now; the Groq
    curator upgrade adds ordering, reasons, naming (curated=True).
    Empty taste falls back to charts (cold start, no LLM spend).
    """
    import hashlib
    names = [a.strip() for a in artists.split(",") if a.strip()][:5]
    genre_list = [g.strip() for g in genres.split(",") if g.strip()][:3]
    excluded = [e.strip() for e in exclude.split(",") if e.strip()]
    if not names and not genre_list:
        charts = SongCache.YTDLP.charts(limit=limit)
        tracks = charts.get("tracks", [])[:limit]
        return {
            "mix_id": "charts",
            "name": "Fresh Mix",
            "blurb": "Trending tracks to get you started.",
            "tracks": [{**t, "reason": ""} for t in tracks],
            "curated": False,
        }
    tracks = SongCache.YTDLP.mix_candidates(
        artist_names=names, genres=genre_list, exclude_titles=excluded, limit=limit,
        fresh=fresh,
    )
    # Stable signature: taste only, NOT the ever-growing exclude list, so
    # repeat tastes (e.g. autoplay continuations) hit the cache instead of
    # burning a fresh Groq call every time.
    sig = hashlib.md5(f"{'|'.join(names)}::{'|'.join(genre_list)}::{limit}".encode()).hexdigest()
    excluded_lower = {e.lower() for e in excluded}
    # Full curator upgrade when a key is configured; otherwise deterministic.
    if Curator.available() and tracks:
        if not fresh:
            cached = Curator.peek(sig)
            if cached:
                survivors = [t for t in cached.get("tracks", []) if t.get("title", "").lower() not in excluded_lower]
                if len(survivors) >= min(3, limit):
                    return {
                        "mix_id": sig,
                        "name": cached.get("name", ""),
                        "blurb": cached.get("blurb", ""),
                        "tracks": survivors[:limit],
                        "curated": True,
                    }
        curated = Curator.curate_cached(sig, names, tracks, limit=limit, fresh=fresh)
        if curated:
            return {
                "mix_id": sig,
                "name": curated["name"],
                "blurb": curated["blurb"],
                "tracks": curated["tracks"],
                "curated": True,
            }
    seed = names[0] if names else genre_list[0]
    return {
        "mix_id": sig,
        "name": f"Mix inspired by {seed}",
        "blurb": "Picked from artists and genres you listen to.",
        "tracks": [{**t, "reason": ""} for t in tracks],
        "curated": False,
    }


@app.get("/api/search")
def _searchAPI(q: str = Query(..., description="Search query string"), max_results: int = Query(10, ge=1, le=20), provider: str = Query("auto", description="Search engine: auto, deezer, itunes or youtube")) -> dict:
    query = (q or "").strip()
    if not query:
        return {"results": [], "provider": "auto"}
    engine = (provider or "auto").strip().lower()
    if engine not in ("auto", "deezer", "itunes", "youtube"):
        engine = "auto"
    return {"results": [_yt_result_to_json(item) for item in SongCache.YTDLP.search(query, max_results=max_results, provider=engine)], "provider": engine}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("_server:app", host="0.0.0.0", port=CoreValues.webPort, reload=False)

