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

# Community-first API: no auth means no cookies/credentials, so wide-open CORS
# is safe. The web app talks to this backend directly from its dev origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# #region debug-point setup
import json as _json, urllib.request as _urllib, time as _time
_DBG = {"url": "http://127.0.0.1:7777/event", "sid": "slow-first-play"}
try:
    with open(".dbg/slow-first-play.env") as _f:
        for _l in _f.read().splitlines():
            if _l.startswith("DEBUG_SERVER_URL="): _DBG["url"] = _l.split("=", 1)[1]
            elif _l.startswith("DEBUG_SESSION_ID="): _DBG["sid"] = _l.split("=", 1)[1]
except Exception:
    pass
def _dbg(run, hyp, loc, msg, **data):
    try:
        _p = _json.dumps({"sessionId": _DBG["sid"], "runId": run, "hypothesisId": hyp, "location": loc, "msg": "[DEBUG] " + msg, "data": data, "ts": int(_time.time() * 1000)}).encode()
        _urllib.urlopen(_urllib.Request(_DBG["url"], data=_p, headers={"Content-Type": "application/json"}), timeout=1).read()
    except Exception:
        pass
# #endregion

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


def _detect_media(data: bytes) -> str:
    """
    Detect the audio container from the leading magic bytes so the browser gets a
    Content-Type that matches the actual bytes (YouTube/WebM-Opus vs Audius-MP3),
    otherwise Chrome picks the wrong demuxer and refuses to play.
    """
    if not data:
        return "application/octet-stream"
    if data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "audio/mpeg"  # MP3
    if data[:4] == b"\x1aE\xdf\xa3":
        return "audio/webm"  # WebM / Matroska (Opus/Vorbis)
    if data[4:8] == b"ftyp":
        return "audio/mp4"  # M4A
    if data[:4] == b"fLaC":
        return "audio/flac"  # FLAC
    return "application/octet-stream"


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
    # #region debug-point B:prepare-start
    _t = _time.time()
    # #endregion
    newID = SongCache.get_song_id(string)
    # #region debug-point B:prepare-done
    _dbg("pre", "B", "_server.py:_prepareAPI", "prepare returned", song_id=newID, elapsed_ms=round((_time.time() - _t) * 1000, 1))
    # #endregion
    return {"ID": newID}


@app.get("/api/fetch/{songID}")
def _fetchAPI(songID: str) -> dict:
    song = SongCache.get_song_data(songID)
    if song is None:
        return {"ERROR": "Song not found"}
    return song.full_dict()


@app.get("/api/audio/{songID}")
def _fetchAudio(songID: str):
    # #region debug-point A:audio-start
    _t = _time.time()
    _dbg("pre", "A", "_server.py:_fetchAudio", "audio request arrived", song_id=songID)
    # #endregion
    song = SongCache.get_song_data(songID)
    # #region debug-point A:waiter-done
    _dbg("pre", "A", "_server.py:_fetchAudio", "get_song_data returned", song_id=songID, elapsed_ms=round((_time.time() - _t) * 1000, 1))
    # #endregion
    if song is None:
        return {"ERROR": "Song not found"}

    gen = song.fetch_data_from_stream()
    # Peek the first chunk so we can serve the correct Content-Type for the actual
    # audio container (WebM-Opus vs MP3 vs M4A). Then stream everything in order.
    try:
        first_chunk = next(gen, None)
    except Exception:
        first_chunk = None
    if first_chunk is None:
        return StreamingResponse(iter([]), media_type="application/octet-stream")

    def _wrap_stream():
        yield first_chunk
        for chunk in gen:
            yield chunk

    return StreamingResponse(_wrap_stream(), media_type=_detect_media(first_chunk))


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

