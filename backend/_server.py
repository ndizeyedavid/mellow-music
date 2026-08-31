import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi import FastAPI, Query
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
    song = SongCache.get_song_data(songID)
    if song is None:
        return {"ERROR": "Song not found"}
    return song.full_dict()


@app.get("/api/audio/{songID}")
def _fetchAudio(songID: str):
    song = SongCache.get_song_data(songID)
    if song is None:
        return {"ERROR": "Song not found"}
    return StreamingResponse(song.fetch_data_from_stream(), media_type="audio/mpeg")


@app.get("/api/home")
def _homeAPI() -> dict:
    results = SongCache.YTDLP.homepage(max_results_per_query=3, max_total=12, cache_ttl_seconds=300)
    return {"results": [_yt_result_to_json(item) for item in results]}


@app.get("/api/search")
def _searchAPI(q: str = Query(..., description="Search query string"), max_results: int = Query(10, ge=1, le=20)) -> dict:
    query = (q or "").strip()
    if not query:
        return {"results": []}
    return {"results": [_yt_result_to_json(item) for item in SongCache.YTDLP.search(query, max_results=max_results)]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("_server:app", host="0.0.0.0", port=CoreValues.webPort, reload=False)

