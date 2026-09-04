import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from customisedLogs import CustomisedLogs

from Classes.Processors.DBHolder import DBHolder
from Classes.Processors.URLHandler import URLHandler
from Classes.Processors.SongProcessor import SongCache
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

