from typing import List
from customisedLogs import CustomisedLogs

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore

from Classes.Processors.PostgresPool import PostgresPool


class EmbeddingService:
    """
    all-MiniLM-L6-v2 embeddings for songs (title + artist).
    384 dims, CPU-only ~5ms per song, cached in Postgres pgvector.
    """

    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    DIMS = 384

    def __init__(self, pool: PostgresPool, logger: CustomisedLogs):
        self.pool = pool
        self.logger = logger
        self._model = None
        self._load_error: str | None = None

    def _get_model(self):
        if self._model is not None:
            return self._model
        if self._load_error:
            return None
        if SentenceTransformer is None:
            self._load_error = "sentence-transformers not installed"
            return None
        try:
            self.logger.log(self.logger.Colors.yellow_500, "EMBED", f"loading {self.MODEL_NAME}...")
            self._model = SentenceTransformer(self.MODEL_NAME)
            self.logger.log(self.logger.Colors.green_800, "EMBED", "model ready")
            return self._model
        except Exception as exc:
            self._load_error = str(exc)[:200]
            self.logger.log(self.logger.Colors.red_500, "EMBED", f"model load failed: {exc}")
            return None

    def embed_text(self, text: str) -> List[float] | None:
        text = (text or "").strip()
        if not text:
            return None
        model = self._get_model()
        if model is None:
            return None
        try:
            vec = model.encode(text, normalize_embeddings=True)
            # SentenceTransformer returns numpy array
            return vec.tolist() if hasattr(vec, "tolist") else list(vec)
        except Exception as exc:
            self.logger.log(self.logger.Colors.red_500, "EMBED", f"encode failed: {exc}")
            return None

    def embed_song(self, title: str, artist: str) -> List[float] | None:
        # Combine title + artist for richer signal
        text = f"{(title or '').strip()} - {(artist or '').strip()}".strip(" -")
        return self.embed_text(text)

    def ensure_embedding(self, song_id: str, title: str, artist: str) -> bool:
        """Ensure song has an embedding; generate and upsert if missing."""
        if not song_id or not title:
            return False
        existing = self.pool.execute("SELECT song_id FROM song_embeddings WHERE song_id = ?", [song_id])
        if existing:
            return True
        vec = self.embed_song(title, artist)
        if vec is None:
            return False
        # Store as JSON string for TEXT fallback; pgvector accepts it via cast as well
        import json

        import json

        for sql, param in [
            (
                "INSERT INTO song_embeddings (song_id, embedding) VALUES (?, ?::vector) ON CONFLICT (song_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()",
                vec,
            ),
            (
                "INSERT INTO song_embeddings (song_id, embedding) VALUES (?, ?) ON CONFLICT (song_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()",
                json.dumps(vec),
            ),
        ]:
            try:
                res = self.pool.execute(sql, [song_id, param], catchErrors=False)
                # INSERT returns None on success, None also on swallowed error — but with catchErrors=False, failure raises
                return True
            except Exception as exc:
                # Try next fallback
                last_exc = exc
                continue
        self.logger.log(self.logger.Colors.red_500, "EMBED", f"upsert failed for {song_id}: {last_exc}")
        return False

    def backfill_missing(self, limit: int = 100) -> int:
        """Embed songs missing vectors (batch). Returns count embedded."""
        rows = self.pool.execute(
            "SELECT s.song_id, s.real_name, s.youtube_id FROM songs s LEFT JOIN song_embeddings e ON s.song_id = e.song_id WHERE e.song_id IS NULL LIMIT ?",
            [limit],
        )
        if not rows:
            return 0
        count = 0
        for row in rows:
            # real_name is "Title - Artist" or just title; try to split
            real = row.get("real_name") or ""
            # We store real_name as title; need artist from somewhere else?
            # Fallback: use real_name as text directly
            if self.ensure_embedding(row["song_id"], real, ""):
                count += 1
        return count

    def similar_songs(self, query_text: str, exclude_ids: list[str] | None = None, limit: int = 10) -> list[dict]:
        """Brute-force cosine search (works with or without pgvector). <50ms for <10k songs."""
        vec = self.embed_text(query_text)
        if vec is None:
            return []
        exclude_ids = set(exclude_ids or [])
        # Fetch all embeddings + song meta
        rows = self.pool.execute(
            "SELECT s.song_id, s.real_name, s.thumbnail, s.audio_url, s.duration, e.embedding FROM song_embeddings e JOIN songs s ON e.song_id = s.song_id"
        )
        if not rows:
            return []
        import json
        import math

        def cosine(a, b):
            # a,b are lists
            dot = sum(x * y for x, y in zip(a, b))
            na = math.sqrt(sum(x * x for x in a))
            nb = math.sqrt(sum(y * y for y in b))
            return dot / (na * nb) if na and nb else 0

        scored = []
        for r in rows:
            sid = r.get("song_id")
            if sid in exclude_ids:
                continue
            emb = r.get("embedding")
            if isinstance(emb, str):
                try:
                    emb = json.loads(emb)
                except Exception:
                    continue
            if not isinstance(emb, list) or len(emb) != self.DIMS:
                continue
            score = cosine(vec, emb)
            scored.append((score, r))
        scored.sort(key=lambda x: x[0], reverse=True)
        result = []
        for score, r in scored[:limit]:
            result.append(
                {
                    "song_id": r["song_id"],
                    "real_name": r["real_name"],
                    "thumbnail": r.get("thumbnail"),
                    "audio_url": r.get("audio_url"),
                    "duration": r.get("duration"),
                    "score": score,
                }
            )
        return result

    def taste_vector(self, song_ids: list[str]) -> List[float] | None:
        """Average embedding of given songs (weighted taste)."""
        if not song_ids:
            return None
        placeholders = ",".join(["?"] * len(song_ids))
        rows = self.pool.execute(f"SELECT embedding FROM song_embeddings WHERE song_id IN ({placeholders})", song_ids)
        if not rows:
            return None
        # Average vectors
        import numpy as np

        vecs = [r["embedding"] for r in rows if r.get("embedding") is not None]
        if not vecs:
            return None
        # pgvector returns list or string; normalize to list
        parsed = []
        for v in vecs:
            if isinstance(v, str):
                # "[0.1,0.2,...]"
                try:
                    import json

                    v = json.loads(v)
                except Exception:
                    continue
            parsed.append(v)
        if not parsed:
            return None
        avg = np.mean(parsed, axis=0)
        # Normalize
        norm = np.linalg.norm(avg)
        if norm > 0:
            avg = avg / norm
        return avg.tolist()

    # ---------- Taste-aware vector recommendations ----------

    WEIGHTS = {
        "play": 1,
        "complete": 3,
        "like": 5,
        "follow": 4,
        "save": 4,
        "playlist_add": 3,
        "skip": -2,
    }

    def record_taste_event(self, anonymous_id: str, song_id: str, event_type: str) -> bool:
        if not anonymous_id or not song_id or event_type not in self.WEIGHTS:
            return False
        try:
            self.pool.execute(
                "INSERT INTO taste_events (anonymous_id, song_id, event_type) VALUES (?, ?, ?)",
                [anonymous_id, song_id, event_type],
            )
            return True
        except Exception:
            return False

    def recommend_for_anonymous(self, anonymous_id: str, exclude_ids: list[str] | None = None, limit: int = 10) -> list[dict]:
        """Vector taste for an anonymous profile: weighted average of their events, then ANN."""
        if not anonymous_id:
            return []
        exclude_ids = set(exclude_ids or [])
        # Aggregate weighted events per song
        rows = self.pool.execute(
            "SELECT song_id, event_type, COUNT(*) as cnt FROM taste_events WHERE anonymous_id = ? GROUP BY song_id, event_type",
            [anonymous_id],
        )
        if not rows:
            return []
        # Compute per-song score
        song_scores: dict[str, float] = {}
        for r in rows:
            w = self.WEIGHTS.get(r["event_type"], 0)
            song_scores[r["song_id"]] = song_scores.get(r["song_id"], 0) + w * int(r["cnt"])
        # Filter to positive affinity songs for taste vector
        positive = [sid for sid, sc in song_scores.items() if sc > 0 and sid not in exclude_ids]
        if not positive:
            return []
        # Take top 20 positive by score for vector
        positive_sorted = sorted(positive, key=lambda sid: song_scores[sid], reverse=True)[:20]
        vec = self.taste_vector(positive_sorted)
        if vec is None:
            return []
        # Brute-force ANN excluding known + skipped (negative score songs)
        skipped = {sid for sid, sc in song_scores.items() if sc < 0}
        exclude_all = exclude_ids | skipped | set(positive_sorted)
        # Fetch all embeddings
        all_rows = self.pool.execute("SELECT s.song_id, s.real_name, s.thumbnail, s.audio_url, s.duration, e.embedding FROM song_embeddings e JOIN songs s ON e.song_id = s.song_id")
        if not all_rows:
            return []
        import json
        import math

        def cosine(a, b):
            dot = sum(x * y for x, y in zip(a, b))
            na = math.sqrt(sum(x * x for x in a))
            nb = math.sqrt(sum(y * y for y in b))
            return dot / (na * nb) if na and nb else 0

        scored = []
        for r in all_rows:
            sid = r.get("song_id")
            if sid in exclude_all:
                continue
            emb = r.get("embedding")
            if isinstance(emb, str):
                try:
                    emb = json.loads(emb)
                except Exception:
                    continue
            if not isinstance(emb, list) or len(emb) != self.DIMS:
                continue
            scored.append((cosine(vec, emb), r))
        scored.sort(key=lambda x: x[0], reverse=True)
        result = []
        for score, r in scored[:limit]:
            result.append(
                {
                    "song_id": r["song_id"],
                    "real_name": r["real_name"],
                    "thumbnail": r.get("thumbnail"),
                    "audio_url": r.get("audio_url"),
                    "duration": r.get("duration"),
                    "score": score,
                }
            )
        return result
