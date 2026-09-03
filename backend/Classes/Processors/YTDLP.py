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
            YoutubeDL({'title': True,
                       'default_search': 'auto',
                       'format': 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio/best',
                       "silent": 1,
                       "retries": 2,
                       "extractor_retries": 3,
                       "file_access_retries": 2,
                       "fragment_retries": 2,
                       "socket_timeout":30,
                       'js_runtimes': {'node': {}}}),
            YoutubeDL({'title': True,
                       'default_search': 'auto',
                       "silent": 1,
                       "retries": 2,
                       "extractor_retries": 3,
                       "file_access_retries": 2,
                       "fragment_retries": 2,
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


    def search_first(self, query:str):
        """Fast flat-search (no format resolution) that returns the top result's metadata."""
        try:
            info = self._search_downloader(f"ytsearch1:{query}")
        except Exception:
            return {}
        if not isinstance(info, dict):
            return {}
        entries = info.get("entries") or []
        if entries and isinstance(entries[0], dict):
            return entries[0]
        return {}


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

    def _cache_set(self, key:str, value:list[dict], ttl_seconds:int):
        if self.redis_client is not None:
            try:
                import json
                self.redis_client.setex(key, ttl_seconds, json.dumps(value, default=str))
                return
            except Exception:
                pass
        with self._search_lock:
            self._search_cache[key] = (datetime.now(), value)

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

    def _search_free(self, query:str, max_results:int=10) -> list[dict]:
        query = (query or "").strip()
        if not query:
            return []

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

    def search(self, query:str, max_results:int=8, cache_ttl_seconds:int=180) -> list[dict]:
        """
        Search YouTube and return a lightweight list of result metadata for homepage/search cards.
        Uses a fast flat-extract mode and keeps the last good value available while a background refresh runs.
        """
        query = (query or "").strip()
        if not query:
            return []

        cache_key = f"ytsearch::{query.lower()}::{max_results}"
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
                    refreshed = self._build_search_results(query, max_results=max_results)
                    if refreshed:
                        self._cache_set(cache_key, refreshed, cache_ttl_seconds)
                Thread(target=_refresh_search, daemon=True).start()
                return stale_results

        free_results = self._search_free(query, max_results=max_results)
        if free_results:
            self._cache_set(cache_key, free_results, cache_ttl_seconds)
            return free_results

        results = self._build_search_results(query, max_results=max_results)
        self._cache_set(cache_key, results, cache_ttl_seconds)
        return results

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
