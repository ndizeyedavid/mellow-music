import os
from threading import Lock

import requests


class AudiusAPI:
    """
    Keyless free music provider (Audius) that returns stable, direct MP3 stream URLs.

    Discovery nodes are resolved from api.audius.co and tried in order until one
    responds, then cached. Falls back to the single well-known discovery host.
    """
    RESOLVER_URL = "https://api.audius.co"
    DEFAULT_HOST = "https://discoveryprovider.audius.co"

    def __init__(self, app_name: str | None = None):
        self.app_name = app_name or os.getenv("AUDIUS_APP_NAME") or "mellow"
        self.HEADER_FOR_REQUEST = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.4664.110 Safari/537.36'}
        self._hosts: list[str] | None = None
        self._lock = Lock()

    def _resolve_hosts(self) -> list[str]:
        if self._hosts is not None:
            return self._hosts
        with self._lock:
            if self._hosts is not None:
                return self._hosts
            hosts = [self.DEFAULT_HOST]
            try:
                res = requests.get(self.RESOLVER_URL, headers=self.HEADER_FOR_REQUEST, timeout=6)
                if res.status_code == 200:
                    data = res.json()
                    candidates = [d.get("host") for d in data.get("data", []) if d.get("host")]
                    if candidates:
                        hosts = [h.rstrip("/") for h in candidates]
            except Exception:
                pass
            self._hosts = hosts
        return self._hosts

    def get_stream_url(self, track_id: str) -> str:
        return f"{self._pick_host()}/v1/tracks/{track_id}/stream?app_name={self.app_name}"

    def _pick_host(self) -> str:
        hosts = self._resolve_hosts()
        return hosts[0]

    def _request_json(self, url: str, timeout: int = 10):
        try:
            res = requests.get(url, headers=self.HEADER_FOR_REQUEST, timeout=timeout)
            if res.status_code != 200:
                return None
            return res.json()
        except Exception:
            return None

    def _search_host(self, query: str, max_results: int, host: str):
        url = f"{host}/v1/tracks/search?query={requests.utils.quote(query)}&app_name={self.app_name}&limit={max_results}"
        return self._request_json(url)

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        """Return normalized track metadata for the given title/artist query."""
        query = (query or "").strip()
        if not query:
            return []
        for host in self._resolve_hosts():
            data = self._search_host(query, max_results, host)
            if not data or not isinstance(data, dict):
                continue
            entries = data.get("data") or []
            results = []
            for item in entries[:max_results]:
                if not isinstance(item, dict):
                    continue
                track_id = item.get("id")
                if not track_id:
                    continue
                user = item.get("user") or {}
                artwork = item.get("artwork") or {}
                results.append({
                    "id": str(track_id),
                    "title": item.get("title") or "Unknown Title",
                    "artist": user.get("name") or user.get("handle") or "Unknown Artist",
                    "thumbnail": artwork.get("1000x1000") or artwork.get("480x480") or artwork.get("150x150") or "",
                    "duration": item.get("duration") or 0,
                    "stream_url": self.get_stream_url(track_id),
                })
            if results:
                return results
        return []

    def match_stream(self, query: str) -> dict | None:
        """Best matching Audius track for the query, or None when nothing reliable is found."""
        results = self.search(query, max_results=10)
        if not results:
            return None
        q_tokens = set(w for w in query.lower().split() if w)
        if not q_tokens:
            return results[0]
        best = None
        best_score = 0
        for res in results:
            title = " ".join(res["title"].lower().split())
            t_tokens = set(title.split())
            score = len(q_tokens & t_tokens)
            if score > best_score:
                best_score = score
                best = res
        if best is None or best_score <= 0:
            return None
        return best
