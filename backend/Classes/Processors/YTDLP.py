import os
from datetime import datetime, timedelta
from threading import Lock, Thread

import requests
from customisedLogs import CustomisedLogs
from yt_dlp import YoutubeDL, cookies

from Classes.Holders.FileInvolved import Files

try:
    import redis
except Exception:  # optional dependency, Redis is not required for local mode
    redis = None


class YTDLP:
    """
    Holds YTLP downloaders
    """
    def __init__(self, logger:CustomisedLogs):
        self.logger = logger
        self.HEADER_FOR_REQUEST = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.4664.110 Safari/537.36'}
        self._search_cache:dict[str, tuple[datetime, list[dict]]] = {}
        self._search_lock = Lock()
        self._homepage_cache:tuple[datetime, list[dict]] | None = None
        self._homepage_lock = Lock()
        self._homepage_refreshing = False
        self._homepage_fallback:list[dict] = [
            {"id": "fallback-home-1", "title": "Trending Now", "artist": "Local Cache", "thumbnail": "", "duration": 0, "url": ""},
            {"id": "fallback-home-2", "title": "Fresh Picks", "artist": "Local Cache", "thumbnail": "", "duration": 0, "url": ""},
            {"id": "fallback-home-3", "title": "Popular Songs", "artist": "Local Cache", "thumbnail": "", "duration": 0, "url": ""},
        ]
        self.redis_client = None
        redis_url = os.getenv("MELLOW_REDIS_URL") or os.getenv("REDIS_URL") or "redis://localhost:6379"
        if redis and redis_url:
            try:
                self.redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
                self.redis_client.ping()
            except Exception:
                self.redis_client = None
        self.home_queries = [
            "trending songs",
            "latest afrobeats songs",
            "new pop songs",
            "latest hip hop songs",
            "top viral songs",
        ]
        self.downloaders:list[YoutubeDL] = [
            # Android client first: not subject to the web-client PO token /
            # visitor-data bot checks that currently fail with 500s.
            YoutubeDL({'title': True,
                       'default_search': 'auto',
                       'format': 'bestaudio',
                       "silent": 1,
                       "retries": 3,
                       "extractor_retries": 3,
                       "file_access_retries": 3,
                       "fragment_retries": 3,
                       "socket_timeout":30,
                       'extractor_args': {'youtube': {'player_client': ['android']}},
                       'js_runtimes': {'node': {}}}),
            YoutubeDL({'title': True,
                       'default_search': 'auto',
                       'format': 'bestaudio',
                       "silent": 1,
                       "retries": 3,
                       "extractor_retries": 3,
                       "file_access_retries": 3,
                       "fragment_retries": 3,
                       "socket_timeout":30,
                       'js_runtimes': {'node': {}}})
        ]
        self.searchDownloaders:list[YoutubeDL] = [
            YoutubeDL({'extract_flat': True,
                       'skip_download': True,
                       'noplaylist': True,
                       'quiet': True,
                       'no_warnings': True,
                       'default_search': 'auto',
                       'js_runtimes': {'node': {}}}),
            YoutubeDL({'extract_flat': True,
                       'skip_download': True,
                       'noplaylist': True,
                       'quiet': True,
                       'no_warnings': True,
                       'default_search': 'auto',
                       'js_runtimes': {'node': {}}})
        ]
        for downloader in self.downloaders + self.searchDownloaders:
            try:
                cookies.load_cookies(Files.COOKIE.YT, None, downloader)
            except Exception:
                pass


    def get_downloader(self, stringValue:str):
        """
        Try with all downloaders based on their priority till the final data is received
        :param stringValue:
        :return:
        """
        for downloader in self.downloaders:
            try:
                return downloader.extract_info(stringValue, download=False)
            except:
                pass

    def _search_downloader(self, stringValue:str):
        for downloader in self.searchDownloaders:
            try:
                return downloader.extract_info(stringValue, download=False)
            except Exception:
                pass
        return None

    def _cache_get(self, key:str):
        if self.redis_client is not None:
            try:
                value = self.redis_client.get(key)
                if value is not None:
                    import json
                    return json.loads(value)
            except Exception:
                pass
        with self._search_lock:
            return self._search_cache.get(key, (None, None))[1] if key in self._search_cache else None

    def _cache_set(self, key:str, value, ttl_seconds:int):
        if self.redis_client is not None:
            try:
                import json
                self.redis_client.setex(key, ttl_seconds, json.dumps(value, default=str))
                return
            except Exception:
                pass
        with self._search_lock:
            self._search_cache[key] = (datetime.now(), value)

    def _memo_get(self, key:str, ttl_seconds:int):
        """TTL-aware cache read (works for any JSON value, not just lists)."""
        if self.redis_client is not None:
            try:
                import json
                value = self.redis_client.get(key)
                if value is not None:
                    return json.loads(value)
            except Exception:
                pass
        with self._search_lock:
            if key in self._search_cache:
                cached_time, cached_value = self._search_cache[key]
                if datetime.now() - cached_time < timedelta(seconds=ttl_seconds):
                    return cached_value
        return None

    def _request_json(self, url:str, timeout:int=12):
        try:
            response = requests.get(url, headers=self.HEADER_FOR_REQUEST, timeout=timeout)
            if response.status_code != 200:
                return None
            return response.json()
        except Exception:
            return None

    def _normalize_free_result(self, item:dict, source:str) -> dict | None:
        if not item:
            return None
        if source == "deezer":
            title = item.get("title") or "Unknown Title"
            artist = item.get("artist")
            artist_name = artist.get("name") if isinstance(artist, dict) else (artist or "Unknown Artist")
            thumbnail = (
                item.get("album", {}).get("cover_medium")
                or item.get("album", {}).get("cover_big")
                or item.get("cover_medium")
                or item.get("cover_big")
                or ""
            )
            duration = item.get("duration") or 0
            url = item.get("link") or ""
            item_id = item.get("id")
        elif source == "itunes":
            title = item.get("trackName") or item.get("collectionName") or "Unknown Title"
            artist_name = item.get("artistName") or "Unknown Artist"
            thumbnail = item.get("artworkUrl600") or item.get("artworkUrl100") or item.get("artworkUrl60") or ""
            duration = int((item.get("trackTimeMillis") or 0) / 1000)
            url = item.get("trackViewUrl") or item.get("collectionViewUrl") or ""
            item_id = item.get("trackId") or item.get("collectionId")
        else:
            return None

        if not item_id:
            return None

        return {
            "id": str(item_id),
            "title": title,
            "artist": artist_name,
            "thumbnail": thumbnail,
            "duration": duration,
            "url": url,
        }

    def _search_deezer(self, query:str, max_results:int=10) -> list[dict]:
        deezer_url = f"https://api.deezer.com/search/track?q={requests.utils.quote(query)}&limit={max_results}"
        deezer_data = self._request_json(deezer_url, timeout=12)
        if deezer_data and isinstance(deezer_data, dict):
            results = []
            for item in (deezer_data.get("data") or [])[:max_results]:
                normalized = self._normalize_free_result(item, "deezer")
                if normalized:
                    results.append(normalized)
            if results:
                return results
        return []

    def _search_itunes(self, query:str, max_results:int=10) -> list[dict]:
        itunes_url = f"https://itunes.apple.com/search?term={requests.utils.quote(query)}&media=music&entity=song&limit={max_results}"
        itunes_data = self._request_json(itunes_url, timeout=12)
        if itunes_data and isinstance(itunes_data, dict):
            results = []
            for item in (itunes_data.get("results") or [])[:max_results]:
                normalized = self._normalize_free_result(item, "itunes")
                if normalized:
                    results.append(normalized)
            if results:
                return results
        return []

    def _search_free(self, query:str, max_results:int=10) -> list[dict]:
        query = (query or "").strip()
        if not query:
            return []

        deezer_results = self._search_deezer(query, max_results=max_results)
        if deezer_results:
            return deezer_results

        return self._search_itunes(query, max_results=max_results)

    def _homepage_free(self, max_results:int=12) -> list[dict]:
        deezer_url = f"https://api.deezer.com/chart/0/tracks?limit={max_results}"
        deezer_data = self._request_json(deezer_url, timeout=12)
        if deezer_data and isinstance(deezer_data, dict):
            results = []
            for item in (deezer_data.get("tracks", {}).get("data") or [])[:max_results]:
                normalized = self._normalize_free_result(item, "deezer")
                if normalized:
                    results.append(normalized)
            if results:
                return results

        fallback_queries = ["trending songs", "popular songs", "new hits", "top songs"]
        results = []
        seen = set()
        for query in fallback_queries:
            for item in self._search_free(query, max_results=3):
                item_id = item.get("id")
                if item_id and item_id not in seen:
                    seen.add(item_id)
                    results.append(item)
            if len(results) >= max_results:
                break
        return results[:max_results]

    def _build_search_results(self, query:str, max_results:int=8) -> list[dict]:
        info = self._search_downloader(f"ytsearch{max_results}:{query}")
        if not info or not isinstance(info, dict):
            return []

        entries = info.get("entries") or []
        results = []
        seen = set()
        for entry in entries[:max_results]:
            if entry is None:
                continue
            item_id = entry.get("id")
            if not item_id or item_id in seen:
                continue
            seen.add(item_id)
            thumbnail = entry.get("thumbnail")
            if not thumbnail and isinstance(entry.get("thumbnails"), list):
                for item in entry["thumbnails"]:
                    if isinstance(item, dict) and item.get("url"):
                        thumbnail = item.get("url")
                        break
            results.append({
                "id": item_id,
                "title": entry.get("title") or "Unknown Title",
                "artist": entry.get("uploader") or entry.get("channel") or "Unknown Artist",
                "thumbnail": thumbnail,
                "duration": entry.get("duration") or 0,
                "url": "https://www.youtube.com/watch?v=" + str(item_id),
            })
        return results

    def search(self, query:str, max_results:int=8, cache_ttl_seconds:int=180, provider:str="auto") -> list[dict]:
        """
        Search and return a lightweight list of result metadata for homepage/search cards.
        provider: "auto" (deezer -> itunes -> youtube fallback chain),
        or "deezer" | "itunes" | "youtube" to force a single engine.
        Uses a fast flat-extract mode and keeps the last good value available while a background refresh runs.
        """
        query = (query or "").strip()
        if not query:
            return []
        provider = (provider or "auto").strip().lower()
        if provider not in ("auto", "deezer", "itunes", "youtube"):
            provider = "auto"

        cache_key = f"ytsearch::{provider}::{query.lower()}::{max_results}"
        now = datetime.now()
        cached = self._cache_get(cache_key)
        if cached:
            with self._search_lock:
                if cache_key in self._search_cache:
                    cached_time, cached_results = self._search_cache[cache_key]
                    if now - cached_time < timedelta(seconds=cache_ttl_seconds):
                        return cached_results
                    stale_results = cached_results
                else:
                    stale_results = cached
            if stale_results:
                def _refresh_search():
                    refreshed = self._search_for_provider(query, provider, max_results=max_results)
                    if refreshed:
                        self._cache_set(cache_key, refreshed, cache_ttl_seconds)
                Thread(target=_refresh_search, daemon=True).start()
                return stale_results

        results = self._search_for_provider(query, provider, max_results=max_results)
        self._cache_set(cache_key, results, cache_ttl_seconds)
        return results

    def _search_for_provider(self, query:str, provider:str, max_results:int=8) -> list[dict]:
        """Run one search pass for a single provider (no fallback chain)."""
        if provider == "deezer":
            return self._search_deezer(query, max_results=max_results)
        if provider == "itunes":
            return self._search_itunes(query, max_results=max_results)
        if provider == "youtube":
            return self._build_search_results(query, max_results=max_results)
        free_results = self._search_free(query, max_results=max_results)
        if free_results:
            return free_results
        return self._build_search_results(query, max_results=max_results)

    def _build_homepage_results(self, max_results_per_query:int=3, max_total:int=12) -> list[dict]:
        results = []
        seen = set()
        for query in self.home_queries:
            for item in self.search(query, max_results=max_results_per_query, cache_ttl_seconds=300):
                item_id = item.get("id")
                if item_id and item_id not in seen:
                    seen.add(item_id)
                    results.append(item)
            if len(results) >= max_total:
                break
        return results[:max_total]

    def warmup_homepage(self, max_results_per_query:int=3, max_total:int=12, cache_ttl_seconds:int=1800):
        """Fill the homepage cache in the background without blocking the first request."""
        with self._homepage_lock:
            if self._homepage_cache is not None and datetime.now() - self._homepage_cache[0] < timedelta(seconds=cache_ttl_seconds):
                return
            if self._homepage_refreshing:
                return
            self._homepage_refreshing = True

        def _refresh_homepage():
            try:
                refreshed = self._build_homepage_results(max_results_per_query=max_results_per_query, max_total=max_total)
                with self._homepage_lock:
                    self._homepage_cache = (datetime.now(), refreshed)
                    self._homepage_fallback = refreshed
            finally:
                with self._homepage_lock:
                    self._homepage_refreshing = False

        Thread(target=_refresh_homepage, daemon=True).start()

    def homepage(self, max_results_per_query:int=3, max_total:int=12, cache_ttl_seconds:int=1800) -> list[dict]:
        """
        Return a fast homepage payload immediately from local cache/fallback.
        Background refresh takes care of the slow YouTube discovery work.
        """
        now = datetime.now()
        with self._homepage_lock:
            cached = self._homepage_cache
            if cached and now - cached[0] < timedelta(seconds=cache_ttl_seconds):
                return cached[1][:max_total]
            stale_results = cached[1][:max_total] if cached else self._homepage_fallback[:max_total]

        if stale_results:
            def _refresh_homepage():
                refreshed = self._build_homepage_results(max_results_per_query=max_results_per_query, max_total=max_total)
                if refreshed:
                    with self._homepage_lock:
                        self._homepage_cache = (datetime.now(), refreshed)
                        self._homepage_fallback = refreshed
            if cached:
                Thread(target=_refresh_homepage, daemon=True).start()
            else:
                Thread(target=_refresh_homepage, daemon=True).start()
            return stale_results

        free_results = self._homepage_free(max_results=max_total)
        if free_results:
            with self._homepage_lock:
                self._homepage_cache = (datetime.now(), free_results)
                self._homepage_fallback = free_results
            return free_results[:max_total]

        if not self._homepage_refreshing:
            self.warmup_homepage(max_results_per_query=max_results_per_query, max_total=max_total, cache_ttl_seconds=cache_ttl_seconds)
        return self._homepage_fallback[:max_total]

    # ------------------------------------------------------------------
    # Free-provider collections: albums, artists, playlists, genres
    # (Deezer-first; shapes are normalized for the public API.)
    # ------------------------------------------------------------------

    DEEZER_API = "https://api.deezer.com"

    @staticmethod
    def _artist_name(value) -> str:
        if isinstance(value, dict):
            return value.get("name") or "Unknown Artist"
        return value or "Unknown Artist"

    def _normalize_album(self, item:dict) -> dict | None:
        if not item or not item.get("id"):
            return None
        artist = item.get("artist") or {}
        return {
            "id": str(item.get("id")),
            "title": item.get("title") or "Unknown Album",
            "artist": self._artist_name(artist),
            "artist_id": str(artist.get("id")) if isinstance(artist, dict) and artist.get("id") else "",
            "cover": item.get("cover_medium") or item.get("cover_big") or item.get("cover") or "",
            "nb_tracks": item.get("nb_tracks") or 0,
        }

    def _normalize_artist(self, item:dict) -> dict | None:
        if not item or not item.get("id"):
            return None
        return {
            "id": str(item.get("id")),
            "name": item.get("name") or "Unknown Artist",
            "picture": item.get("picture_medium") or item.get("picture_big") or item.get("picture") or "",
            "fans": item.get("nb_fan") or 0,
        }

    def _normalize_playlist(self, item:dict, creator_key:str="user") -> dict | None:
        if not item or not item.get("id"):
            return None
        creator = item.get("creator") or item.get(creator_key) or {}
        return {
            "id": str(item.get("id")),
            "title": item.get("title") or "Untitled Playlist",
            "picture": item.get("picture_medium") or item.get("picture_big") or item.get("picture") or "",
            "creator": creator.get("name") if isinstance(creator, dict) else "",
            "nb_tracks": item.get("nb_tracks") or 0,
        }

    def _normalize_genre(self, item:dict) -> dict | None:
        if not item or not item.get("id"):
            return None
        return {
            "id": str(item.get("id")),
            "name": item.get("name") or "Unknown",
            "picture": item.get("picture_medium") or item.get("picture_big") or item.get("picture") or "",
        }

    def _normalize_detail_track(self, item:dict, fallback_cover:str="") -> dict | None:
        """Track inside album/artist/playlist payloads, in discovery shape."""
        if not item or not item.get("id"):
            return None
        album = item.get("album") or {}
        cover = ""
        if isinstance(album, dict):
            cover = album.get("cover_medium") or album.get("cover_big") or ""
        return {
            "id": str(item.get("id")),
            "title": item.get("title") or item.get("title_short") or "Unknown Title",
            "artist": self._artist_name(item.get("artist")),
            "thumbnail": cover or fallback_cover,
            "duration": item.get("duration") or 0,
            "url": item.get("link") or "",
        }

    def charts(self, limit:int=10, cache_ttl_seconds:int=600) -> dict:
        """Deezer charts: top tracks, albums, artists and playlists in one call."""
        cache_key = f"dz:charts:{limit}"
        cached = self._memo_get(cache_key, cache_ttl_seconds)
        if cached:
            return cached
        result = {"tracks": [], "albums": [], "artists": [], "playlists": []}
        try:
            data = self._request_json(f"{self.DEEZER_API}/chart/0?limit={limit}", timeout=12)
            if data and isinstance(data, dict):
                tracks = [self._normalize_free_result(t, "deezer") for t in (data.get("tracks", {}) or {}).get("data", []) or []]
                result["tracks"] = [t for t in tracks if t][:limit]
                albums = [self._normalize_album(a) for a in (data.get("albums", {}) or {}).get("data", []) or []]
                result["albums"] = [a for a in albums if a][:limit]
                artists = [self._normalize_artist(a) for a in (data.get("artists", {}) or {}).get("data", []) or []]
                result["artists"] = [a for a in artists if a][:limit]
                playlists = [self._normalize_playlist(p) for p in (data.get("playlists", {}) or {}).get("data", []) or []]
                result["playlists"] = [p for p in playlists if p][:limit]
        except Exception:
            pass
        if any(result.values()):
            self._cache_set(cache_key, result, cache_ttl_seconds)
        return result

    def genres(self, cache_ttl_seconds:int=86400) -> list[dict]:
        """Deezer genre list (skips the id=0 'All' pseudo-genre with no art)."""
        cache_key = "dz:genres"
        cached = self._memo_get(cache_key, cache_ttl_seconds)
        if cached:
            return cached
        results = []
        try:
            data = self._request_json(f"{self.DEEZER_API}/genre", timeout=12)
            if data and isinstance(data, dict):
                for item in data.get("data") or []:
                    if str(item.get("id")) == "0":
                        continue
                    normalized = self._normalize_genre(item)
                    if normalized:
                        results.append(normalized)
        except Exception:
            pass
        if results:
            self._cache_set(cache_key, results, cache_ttl_seconds)
        return results

    def search_collection(self, kind:str, query:str, max_results:int=10, cache_ttl_seconds:int=300) -> list[dict]:
        """Search Deezer albums, artists or playlists. kind in {album, artist, playlist}."""
        kind = (kind or "").strip().lower()
        query = (query or "").strip()
        if kind not in ("album", "artist", "playlist") or not query:
            return []
        cache_key = f"dz:search:{kind}:{query.lower()}:{max_results}"
        cached = self._memo_get(cache_key, cache_ttl_seconds)
        if cached:
            return cached
        results = []
        try:
            import requests
            url = f"{self.DEEZER_API}/search/{kind}?q={requests.utils.quote(query)}&limit={max_results}"
            data = self._request_json(url, timeout=12)
            if data and isinstance(data, dict):
                for item in (data.get("data") or [])[:max_results]:
                    if kind == "album":
                        normalized = self._normalize_album(item)
                    elif kind == "artist":
                        normalized = self._normalize_artist(item)
                    else:
                        normalized = self._normalize_playlist(item)
                    if normalized:
                        results.append(normalized)
        except Exception:
            pass
        if results:
            self._cache_set(cache_key, results, cache_ttl_seconds)
        return results

    def album_details(self, album_id:str, cache_ttl_seconds:int=3600) -> dict | None:
        """Album header + full tracklist. Track playback still goes via prepare/fetch."""
        album_id = (album_id or "").strip()
        if not album_id:
            return None
        cache_key = f"dz:album:{album_id}"
        cached = self._memo_get(cache_key, cache_ttl_seconds)
        if cached:
            return cached
        try:
            data = self._request_json(f"{self.DEEZER_API}/album/{album_id}", timeout=12)
            if not data or not isinstance(data, dict) or data.get("error"):
                return None
            cover = data.get("cover_big") or data.get("cover_medium") or ""
            artist = data.get("artist") or {}
            album = {
                "id": str(data.get("id")),
                "title": data.get("title") or "Unknown Album",
                "artist": self._artist_name(artist),
                "artist_id": str(artist.get("id")) if isinstance(artist, dict) and artist.get("id") else "",
                "cover": cover,
                "nb_tracks": data.get("nb_tracks") or 0,
                "release_date": data.get("release_date") or "",
                "label": data.get("label") or "",
            }
            tracks = []
            for item in ((data.get("tracks") or {}).get("data") or []):
                normalized = self._normalize_detail_track(item, fallback_cover=cover)
                if normalized:
                    tracks.append(normalized)
            result = {"album": album, "tracks": tracks}
            self._cache_set(cache_key, result, cache_ttl_seconds)
            return result
        except Exception:
            return None

    def artist_details(self, artist_id:str, top_limit:int=10, album_limit:int=8, cache_ttl_seconds:int=3600) -> dict | None:
        """Artist header + top tracks + albums."""
        artist_id = (artist_id or "").strip()
        if not artist_id:
            return None
        cache_key = f"dz:artist:{artist_id}:{top_limit}:{album_limit}"
        cached = self._memo_get(cache_key, cache_ttl_seconds)
        if cached:
            return cached
        try:
            data = self._request_json(f"{self.DEEZER_API}/artist/{artist_id}", timeout=12)
            if not data or not isinstance(data, dict) or data.get("error"):
                return None
            artist = {
                "id": str(data.get("id")),
                "name": data.get("name") or "Unknown Artist",
                "picture": data.get("picture_big") or data.get("picture_medium") or "",
                "fans": data.get("nb_fan") or 0,
                "nb_albums": data.get("nb_album") or 0,
            }
            top_tracks = []
            top_data = self._request_json(f"{self.DEEZER_API}/artist/{artist_id}/top?limit={top_limit}", timeout=12)
            if top_data and isinstance(top_data, dict):
                for item in (top_data.get("data") or [])[:top_limit]:
                    normalized = self._normalize_detail_track(item)
                    if normalized:
                        top_tracks.append(normalized)
            albums = []
            album_data = self._request_json(f"{self.DEEZER_API}/artist/{artist_id}/albums?limit={album_limit}", timeout=12)
            if album_data and isinstance(album_data, dict):
                for item in (album_data.get("data") or [])[:album_limit]:
                    normalized = self._normalize_album(item)
                    if normalized:
                        albums.append(normalized)
            result = {"artist": artist, "top_tracks": top_tracks, "albums": albums}
            self._cache_set(cache_key, result, cache_ttl_seconds)
            return result
        except Exception:
            return None

    def playlist_details(self, playlist_id:str, cache_ttl_seconds:int=1800) -> dict | None:
        """Curated playlist header + tracklist."""
        playlist_id = (playlist_id or "").strip()
        if not playlist_id:
            return None
        cache_key = f"dz:playlist:{playlist_id}"
        cached = self._memo_get(cache_key, cache_ttl_seconds)
        if cached:
            return cached
        try:
            data = self._request_json(f"{self.DEEZER_API}/playlist/{playlist_id}", timeout=12)
            if not data or not isinstance(data, dict) or data.get("error"):
                return None
            creator = data.get("creator") or {}
            playlist = {
                "id": str(data.get("id")),
                "title": data.get("title") or "Untitled Playlist",
                "picture": data.get("picture_big") or data.get("picture_medium") or "",
                "creator": creator.get("name") if isinstance(creator, dict) else "",
                "description": (data.get("description") or "").strip(),
                "nb_tracks": data.get("nb_tracks") or 0,
                "fans": data.get("fans") or 0,
            }
            tracks = []
            for item in ((data.get("tracks") or {}).get("data") or []):
                normalized = self._normalize_detail_track(item)
                if normalized:
                    tracks.append(normalized)
            result = {"playlist": playlist, "tracks": tracks}
            self._cache_set(cache_key, result, cache_ttl_seconds)
            return result
        except Exception:
            return None
