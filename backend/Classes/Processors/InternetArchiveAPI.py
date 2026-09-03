import re

import requests


class InternetArchiveAPI:
    """
    Keyless free music provider (Internet Archive) returning direct MP3 stream URLs.

    Performs a lightweight advancedsearch to find matching audio items, then reads
    the item metadata to locate a real MP3 file. Everything is wrapped defensively:
    any failing call simply returns no results so playback falls through to the next
    source (YouTube) instead of erroring.
    """
    SEARCH_URL = "https://archive.org/advancedsearch.php"
    METADATA_URL = "https://archive.org/metadata/{identifier}"

    def __init__(self):
        self.HEADER_FOR_REQUEST = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.4664.110 Safari/537.36'}

    def _request_json(self, url: str, timeout: int = 5):
        try:
            res = requests.get(url, headers=self.HEADER_FOR_REQUEST, timeout=timeout)
            if res.status_code != 200:
                return None
            return res.json()
        except Exception:
            return None

    def _stream_url(self, identifier: str, filename: str) -> str:
        return f"https://archive.org/download/{identifier}/{requests.utils.quote(filename)}"

    def _pick_mp3(self, identifier: str) -> dict | None:
        meta = self._request_json(self.METADATA_URL.format(identifier=identifier))
        if not meta or not isinstance(meta, dict):
            return None
        files = meta.get("files") or []
        for f in files:
            name = str(f.get("name") or "")
            fmt = str(f.get("format") or "")
            if name.lower().endswith(".mp3") or "mp3" in fmt.lower():
                length = 0
                try:
                    parts = (f.get("length") or "").split(":")
                    length = sum(int(x) * 60 ** (len(parts) - i - 1) for i, x in enumerate(parts))
                except Exception:
                    length = 0
                return {
                    "stream_url": self._stream_url(identifier, name),
                    "duration": length,
                }
        return None

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        """Return normalized track metadata with a direct MP3 stream URL where available."""
        query = (query or "").strip()
        if not query:
            return []
        # Simple keyword search scoped to audio items.
        keywords = re.sub(r"\s+", " AND ", re.sub(r"[^\w\s]", " ", query.lower()).strip())
        if not keywords:
            keywords = query
        params = [
            "q=" + requests.utils.quote(f"mediatype:audio AND ({keywords})"),
            "fl%5B%5D=identifier",
            "fl%5B%5D=title",
            "fl%5B%5D=creator",
            f"rows={max_results}",
            "page=1",
            "output=json",
        ]
        data = self._request_json(self.SEARCH_URL + "?" + "&".join(params))
        if not data or not isinstance(data, dict):
            return []
        docs = (data.get("response") or {}).get("docs") or []
        results = []
        for doc in docs[:max_results]:
            identifier = doc.get("identifier")
            if not identifier:
                continue
            mp3 = self._pick_mp3(identifier)
            if not mp3:
                continue
            results.append({
                "id": identifier,
                "title": doc.get("title") or "Unknown Title",
                "artist": doc.get("creator") or "Unknown Artist",
                "thumbnail": "",
                "duration": mp3["duration"],
                "stream_url": mp3["stream_url"],
            })
            # Cheap probe: stop after a couple of usable items so a slow/unreachable
            # archive never stalls the fallback chain to YouTube.
            if len(results) >= 3:
                break
        return results

    def match_stream(self, query: str) -> dict | None:
        """Best matching Internet Archive track for the query, or None when nothing reliable is found."""
        results = self.search(query, max_results=8)
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
        return best if best is not None else results[0]
