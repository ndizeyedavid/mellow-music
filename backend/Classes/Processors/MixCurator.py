import json
import os
import threading
from datetime import datetime, timedelta
from threading import Lock

import requests


DEFAULT_MODEL = "openai/gpt-oss-20b"
# Fallback cooldown after a 429 before any new Groq call is attempted.
COOLDOWN_SECONDS = 60


class MixCurator:
    """
    Groq-powered full curator for taste mixes. Ranks a deterministic
    candidate pool, writes one-line reasons, and names the mix — but may
    ONLY reference candidate IDs from the supplied list, so hallucinations
    are impossible by construction. Any failure degrades to the
    deterministic order with generic reasons (never a 500, never empty).
    """

    def __init__(self, logger=None):
        self.logger = logger
        self._lock = Lock()
        self._mix_cache:dict[str, tuple[datetime, dict]] = {}
        self._cache_lock = Lock()
        # Single-flight: concurrent identical requests share one Groq call.
        self._inflight:dict[str, threading.Event] = {}
        self._inflight_lock = Lock()
        # 429 circuit breaker: timestamp until which Groq is left alone.
        self._cooldown_until:datetime | None = None

    @staticmethod
    def _config() -> tuple[str, str]:
        model = (os.getenv("GROQ_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
        return (os.getenv("GROQ_API_KEY") or "").strip(), model

    def available(self) -> bool:
        key, _ = self._config()
        return bool(key)

    def curate(self, artists:list[str], candidates:list[dict], limit:int=12, cache_ttl_seconds:int=21600) -> dict | None:
        """
        Returns {"name", "blurb", "tracks": [{...candidate, "reason"}]}
        or None when curation is unavailable/failed (caller falls back).
        :param artists: top artist names driving the mix (for naming)
        :param candidates: discovery-shaped tracks with "id"
        :param limit: max tracks to return
        """
        key, model = self._config()
        if not key or not candidates:
            return None
        if self._cooling_down():
            return None
        pool = [c for c in candidates if c.get("id")][:40]
        if not pool:
            return None

        numbered = "\n".join(
            f"{i+1}. [id={c['id']}] {c.get('title')} — {c.get('artist')}"
            for i, c in enumerate(pool)
        )
        prompt = (
            "You are a music curator. The listener loves: "
            + (", ".join(artists[:5]) or "popular music")
            + ".\nRank the candidate tracks below for them (best first), "
            f"pick at most {limit}, and give each a reason under 12 words. "
            "Reply with STRICT JSON only, exactly this shape:\n"
            '{"name": "short playlist name", "blurb": "one sentence", '
            '"tracks": [{"id": "<id from the list>", "reason": "<why>"}]}\n'
            "Use ONLY ids from the candidate list. No other text.\n"
            f"Candidates:\n{numbered}"
        )

        try:
            with self._lock:
                response = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 1200,
                        "response_format": {"type": "json_object"},
                    },
                    timeout=45,
                )
            if response.status_code == 429:
                self._start_cooldown(response.headers.get("Retry-After"))
                return None
            if response.status_code != 200:
                self._log(f"Groq HTTP {response.status_code}: {response.text[:200]}")
                return None
            content = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return self._apply(pool, artists, parsed, limit)
        except Exception as exc:
            self._log(f"Groq curation failed: {exc}")
            return None

    def _apply(self, pool:list[dict], artists:list[str], parsed:dict, limit:int) -> dict | None:
        """Validate ids against the pool and merge reasons. None if unusable."""
        try:
            by_id = {str(c["id"]): c for c in pool}
            picks = parsed.get("tracks") or []
            tracks = []
            seen = set()
            for pick in picks:
                pid = str(pick.get("id") or "")
                if not pid or pid in seen or pid not in by_id:
                    continue
                seen.add(pid)
                track = dict(by_id[pid])
                reason = (pick.get("reason") or "").strip()
                track["reason"] = reason[:120]
                tracks.append(track)
                if len(tracks) >= limit:
                    break
            if not tracks:
                return None
            name = (parsed.get("name") or "").strip()[:60] or f"Mix inspired by {artists[0] if artists else 'you'}"
            blurb = (parsed.get("blurb") or "").strip()[:200]
            return {"name": name, "blurb": blurb, "tracks": tracks}
        except Exception as exc:
            self._log(f"Curator output rejected: {exc}")
            return None

    def curate_cached(self, signature:str, artists:list[str], candidates:list[dict], limit:int=12, cache_ttl_seconds:int=21600, fresh:bool=False) -> dict | None:
        """
        Cached curation: repeat tastes return instantly without LLM spend.
        fresh=True bypasses the read (still writes) for forced re-curation.
        Concurrent identical requests share a single Groq call (single-flight).
        Returns the curated dict or None (caller falls back to deterministic).
        """
        hit = None if fresh else self.peek(signature, cache_ttl_seconds)
        if hit:
            return hit
        with self._inflight_lock:
            waiter = self._inflight.get(signature)
            if waiter is None:
                waiter = threading.Event()
                self._inflight[signature] = waiter
                owner = True
            else:
                owner = False
        if not owner:
            waiter.wait(timeout=90)
            return self.peek(signature, cache_ttl_seconds)
        try:
            result = self.curate(artists, candidates, limit=limit)
            if result:
                with self._cache_lock:
                    self._mix_cache[signature] = (datetime.now(), result)
            return result
        finally:
            with self._inflight_lock:
                self._inflight.pop(signature, None)
            waiter.set()

    def _cooling_down(self) -> bool:
        return (
            self._cooldown_until is not None
            and datetime.now() < self._cooldown_until
        )

    def _start_cooldown(self, retry_after:str | None) -> None:
        try:
            seconds = int((retry_after or "").strip())
            if seconds <= 0 or seconds > 600:
                seconds = COOLDOWN_SECONDS
        except (ValueError, AttributeError):
            seconds = COOLDOWN_SECONDS
        self._cooldown_until = datetime.now() + timedelta(seconds=seconds)
        self._log(f"Groq rate-limited: cooling down for {seconds}s")

    def peek(self, signature:str, cache_ttl_seconds:int=21600) -> dict | None:
        """Fresh cache read without triggering any LLM call."""
        with self._cache_lock:
            if signature in self._mix_cache:
                cached_time, cached_value = self._mix_cache[signature]
                if datetime.now() - cached_time < timedelta(seconds=cache_ttl_seconds):
                    return cached_value
        return None

    def _log(self, message:str) -> None:
        try:
            if self.logger is not None:
                self.logger.error(message)
        except Exception:
            pass
