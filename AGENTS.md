# AGENTS.md

This file exists so future coding agents do not guess, hallucinate, or rewrite the project around the wrong mental model.
It is the **single source of truth** for the current architecture after the 2026-09 full rework. Read it before any major change.

## Project identity

Mellow Music is a community-first, **no-login, no-account, ad-free, free forever** music project.

- free forever, no paywall for basic access, no ads
- **no-login philosophy is a hard constraint** — anonymous taste only (`mellow_id` in localStorage), never real accounts
- backend-first architecture, web app first, mobile app later
- Spotify-inspired UX, YouTube-level recommendations are the north star, but without training from scratch

This project is not a generic SaaS template. Do not add login walls, paid tiers, or ad models.

## Repository structure

Repo root: `C:\Users\MELLOW\Desktop\Projects\mellow-music` (also `mellow-music` on GitHub: `ndizeyedavid/mellow-music`)

```
backend/               — FastAPI app, DB, discovery, streaming
  _server.py           — FastAPI entrypoint (all /api/* routes)
  schema.sql           — Postgres + pgvector clean-slate schema (idempotent)
  pyproject.toml       — build + fastapi entrypoint (_server:app), python 3.13 pin
  requirements.txt     — mirrored deps (fastapi[standard], psycopg[binary], pgvector, etc.)
  Classes/Processors/
    YTDLP.py           — discovery/search/cache + Deezer/iTunes/YouTube + Invidious fallback
    SongProcessor.py   — SongCache: prepare/fetch, DB aliases, expiry, embedding hook
    SongData.py        — per-song holder, lazy stream, timezone-aware datetimes
    DBHolder.py        — Postgres pool bootstrap + schema apply
    PostgresPool.py    — psycopg pool, TLS, ?->%s, health-check + retry
    MySQLPool.py       — legacy MySQL pool (kept for fallback, vector branch uses Postgres)
    EmbeddingService.py— all-MiniLM / BGE via fastembed (ONNX) + pgvector
    MixCurator.py      — Groq curator (full curator, hallucination-proof)
  Classes/Holders/     — DBTables, FileInvolved, UrlTypes
  Hidden/
    Secrets.py         — now env-driven with safe defaults, committed (not gitignored)
    dynamicWebsite.py  — legacy dynamic web system (still present, not used by React app)
  Static/HTML/         — legacy templates (kept, not used by React)

frontend/              — React 19 + Vite 8 + Tailwind 4 + PWA
  index.html           — full SEO/PWA/OG/Twitter/JSON-LD
  vercel.json          — SPA rewrites for Vercel (refresh on /search etc. never 404s)
  vite.config.ts       — vite-plugin-pwa with manifest + Workbox
  public/
    favicon.svg, pwa-logo.png, og-image.png (1200x630), icons/* (16/32/48/180/192/512 any+maskable), robots.txt, sitemap.xml
  src/
    api/client.ts, api/music.ts, api/taste.ts — axios + typed API layer
    components/        — ApiCards, ApiTrackList, BottomPlayer, FullscreenPlayer, ArtworkPopup, Vinyl, OfflineDownloadButton, GlobalDownloadBar, OfflineBanner, etc.
    context/           — PlayerContext (expiry-resume + autoplay), PlaylistContext (v2), LibraryContext (likes), DownloadQueueContext
    hooks/             — useAudioPlayer (dual-element crossfade), usePlayDiscovery (lookahead + dedup), useOfflineDownloads, useNetworkStatus, etc.
    pages/             — HomePage (charts + taste), ExplorePage (moods + genre explorer), SearchPage (multi-type + infinite scroll), AlbumPage, ArtistDetailPage, PlaylistDetailPage, MixPage, LikedPage, DownloadsPage, TracksPage (Recently Played)
    utils/             — history.ts, anonymous.ts (mellow_id), affinity.ts (decay), taste.ts, playlists.ts, offlineDB.ts (IndexedDB), searchProvider.ts
    types.ts           — shared Track type

Other important files:
  .env / .env.example — root env (backend + frontend VITE_API_BASE_URL)
  frontend/.env        — VITE_API_BASE_URL=http://127.0.0.1:10020 (local) / https://mellow-music.fastapicloud.dev (prod)
  .venv/ / frontend/node_modules/ — local envs (gitignored)
```

Active branches (as of 2026-09-08):
- `main` — stable, contains: hosting readiness, offline v1 (shell + downloads), PWA/SEO, YouTube fixes, watchdog, vector-OOM guard. Deployed to FastAPI Cloud + Vercel.
- `feat/vector-taste-recommendations` — vector taste engine (Postgres + pgvector, embeddings, taste_events, real-time ANN). Not yet merged to `main`. Created from `feat/ai-powered-recommendations` with a clean-slate DB (no migration).
- `optimazation/backend-and-frontend-e2e-refactoring` — earlier hosting readiness work, now merged.
- `feat/offline-shell` — merged into `main` as `7a40fe2`.

## Core architecture

### 1) Backend-first product (now FastAPI, not Flask)

The app is **FastAPI + uvicorn[standard]** (port `10020` locally, `PORT` on platform). `gevent`/`Flask` remain in `requirements.txt` only for the legacy `dynamicWebsite` path. New code uses FastAPI exclusively.

The backend is the real product. UI work must not break API stability, discovery, or cache correctness. The file `MusicAPI_servers.py` and `WSGIElements.py` are legacy.

### 2) Search and discovery pipeline (`YTDLP.py`)

- **Preferred order:** Deezer metadata first (`deezer_track_meta`), then yt-dlp search (android client), then Invidious fallback, then Deezer 30s preview. Saavn chain was removed (horrible catalog) after being tried and reverted.
- **Engines:** `provider` param on `/api/search` — `auto` (Deezer -> iTunes -> YouTube), `deezer`, `itunes`, `youtube`.
- **Resilience:** searchDownloaders now include android extractor_args, bounded retries/timeouts, proxy via `YTDLP_PROXY`, cookies via `YT_COOKIES_B64`, Invidious search+streams fallback (4 instances), sanitized queries for quoted titles (e.g. `Blaze Of Glory (From "Young Guns II")`).
- **Collections:** Deezer-first for albums/artists/playlists/genres/charts (`/api/charts`, `/api/genres`, `/api/search/albums|artists|playlists`, `/api/album/{id}`, `/api/artist/{id}`, `/api/playlist/{id}`).

### 3) Cache strategy

- Redis when available (`MELLOW_REDIS_URL` or `REDIS_URL`, `rediss://` for TLS), in-memory `dict` fallback.
- Stale-while-revalidate: stale results served immediately, background refresh fills fresh values.
- Search results are per-`provider` cache keys. Deezer and charts are heavily cached.

### 4) Song preparation pipeline (`SongCache`)

- Lookup by name/URL via `URLHandler.strip` -> DB alias vs `songs` table vs new `RandomisedString` ID.
- `__fetch_new` is category-aware (YT_URL, SPOTIFY_URL, UNKNOWN). For `UNKNOWN`, it now tries YuTube full-length with multiple sanitized queries before any preview.
- `__cache_from_db` + `__renew_expiry` + `__remove_cache` (4h idle) manage in-memory + DB persistence.
- **Expiry:** `last_updated + 5h` (`timestamptz` aware, `datetime.now(timezone.utc)` everywhere — fixes naive/aware compare bug that broke offline).
- **Embedding hook:** after every successful save, `Thread(target=__ensure_embedding)` generates `all-MiniLM`/`BGE` vectors asynchronously (non-blocking).
- **Failure safety:** `__fail_fetch` records `song.error` and releases waiters so `/api/fetch` returns `{"ERROR": ...}` never 500s. Waiters are bounded (180s).

### 5) Vector taste engine (vector branch only, Postgres + pgvector)

- **Schema:** `taste_events (anonymous_id, song_id, event_type)` linked by `song_id` (your requested relationship), and `song_embeddings (song_id, embedding vector(384))` with TEXT fallback + brute-force cosine when `vector` extension missing (Windows local). HNSW index on Aiven.
- **Service:** `EmbeddingService` — `sentence-transformers/all-MiniLM-L6-v2` preferred via `fastembed` ONNX (~100MB) over `torch` (~400MB), lazy-loaded, `ENABLE_VECTOR` kill-switch (defaults to `false` on cloud to prevent OOM, `true` locally). Brute-force `<50ms` for <10k songs, no pgvector needed locally.
- **Taste:** `buildTaste` blends frequency (history weight 1, playlists weight 2) with `affinity.ts` signals (play 1, complete 3, like 5, skip -2, 45-day half-life decay). `recommend_for_anonymous` does weighted average taste vector then ANN excluding skipped/known.

## Public API shape (`backend/_server.py`)

All under FastAPI, CORS via `CORSMiddleware` (allow `GET,POST,OPTIONS`, origins from `ALLOWED_ORIGINS`).

Core playback:
- `GET /api/prepare/{string:path}` -> `{"ID": id}`
- `GET /api/fetch/{songID}` -> full song dict or `{"ERROR": ...}` (includes `AUDIO_URL` for direct `<audio>` play — never `/api/audio` for normal playback)
- `GET /api/offline-audio/{songID}` — **CORS-friendly proxy** for offline downloads (streams `AUDIO_URL` through backend, used by `DownloadQueueContext` to avoid googlevideo ACAO block)
- `GET /api/audio/{songID}` — legacy stream, still present but buggy, not used by frontend

Discovery:
- `GET /api/home` — homepage discovery (now also `GET /api/charts`, `GET /api/genres`)
- `GET /api/search?q=&max_results=&provider=auto|deezer|itunes|youtube` -> `{"results": [...], "provider": engine}`
- `GET /api/search/albums|artists|playlists`
- `GET /api/album/{id}`, `/api/artist/{id}`, `/api/playlist/{id}`
- `GET /api/mix?artists=&genres=&exclude=&limit=&fresh=` -> `{"mix_id","name","blurb","tracks","curated"}` (Groq when `GROQ_API_KEY` set, else deterministic)
- `POST /api/taste/event` `{anonymous_id,song_id,event_type}` and `GET /api/recommend/vector?anonymous_id=&exclude=&limit=` (vector branch)

Ops:
- `GET /`, `GET /health`, `GET /docs`, `GET /api/watchdog` (probes YouTube search, POSTs to `ntfy.sh/{NTFY_TOPIC}` with `white_check_mark` or `rotating_light`, daily at 12:00 via cron-job.org)

## Environment variables

Root `.env` (loaded by `_server.py` minimal loader) + `frontend/.env` for Vite.

Backend (see `.env.example` for full template):
- `MELLOW_REDIS_URL` / `REDIS_URL` — `redis://` local, `rediss://` for TLS (Redis official)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — legacy MySQL vars (fallback)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`, `DB_SSL_CA` — Postgres + pgvector (vector branch primary, Aiven)
- `ALLOWED_ORIGINS` — comma-separated web origins (e.g. `https://themellowmusic.vercel.app`), `*` for local
- `PORT` / `WEB_PORT` — platform injects `PORT`, default `10020`
- `FERNET_KEY` — override for `ServerSecrets.fernetKey`
- `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-20b`, swappable)
- `YT_COOKIES_B64` — base64 Netscape cookies for yt-dlp (host can't receive file, gitignored)
- `YTDLP_PROXY` — `http://user:pass@host:port` residential proxy for yt-dlp
- `NTFY_TOPIC` — topic name or full `https://ntfy.sh/...` URL for watchdog
- `ENABLE_VECTOR` — `true` to enable embeddings (defaults to `false` on cloud to stay lean, `true` locally)

Frontend `frontend/.env`:
- `VITE_API_BASE_URL` — `http://127.0.0.1:10020` local, `https://mellow-music.fastapicloud.dev` prod (build-time, redeploy after change)

Rules: never commit real secrets, keep `.env` gitignored, use deploy env vars in production.

## Secrets and config expectations

`backend/Hidden/Secrets.py` is now **env-driven with safe defaults and committed** (previously gitignored). It still defines `ServerSecrets`, `CoreValues`, `DBSecrets`, `RequiredFiles` but reads from env. Legacy `fernetKey = '5vrX...'` is now a dev-only placeholder. `RequiredFiles` lists `MySQLPool.py`, `PostgresPool.py`, `EmbeddingService.py`, `schema.sql`, etc.

When changing:
- keep `CoreValues.webPort` reading `PORT` first
- do not hardcode DB hosts; use `DBHolder` which prefers env
- Temp dirs (`Folders.temp`, `Folders.autoTemp`) are auto-created at startup

## Local startup

Backend (FastAPI):
```powershell
# from project root, venv with Python 3.13
.\.venv\Scripts\python.exe backend\_server.py
# or
uvicorn _server:app --reload --app-dir backend
# Docs at http://127.0.0.1:10020/docs
```
Frontend (Vite):
```powershell
npm --prefix frontend run dev
# http://localhost:5173
```
Full stack local:
- Postgres local: `postgres` / `mellow@123` / `mellow_music` on 5432 (vector branch), MySQL `root`/`musicapi` on 3306 (main). `schema.sql` auto-applies.
- Redis local: `redis://localhost:6379`

## Web and UI model

The project is now a **modern React frontend** (Vite + Tailwind 4 + React Router), not the legacy dynamic website.

Key frontend concerns:
- **PWA:** `vite-plugin-pwa` with `manifest.webmanifest`, `sw.js` (Workbox), `includeAssets` for icons, runtimeCaching for `cdn-images.dzcdn.net` and `api.deezer.com`, `navigateFallback` for SPA offline shell.
- **SEO:** `index.html` has full SEO/PWA/OG/Twitter/JSON-LD, `robots.txt`, `sitemap.xml`, `og-image.png` (1200x630), icons 16/32/48/180/192/512 (any+maskable), `theme_color #171719`, canonical to `https://themellowmusic.vercel.app`, `useDocumentTitle` syncs meta on navigation.
- **Player:** `useAudioPlayer` is dual-element crossfade (front/back `<audio>`, `requestAnimationFrame` ramp, `frontIdxRef`), shuffle/repeat, Media Session, expiry-resume via `refreshTrack`, queue persistence (`mellow-player-v1` in localStorage: queue + index + position), and `onQueueExhausted` for taste-seeded autoplay.
- **Queue:** `usePlayDiscovery` does lookahead (LOOKAHEAD=2), client-side `prepare`/`fetch` caching with TTL + in-flight dedup, `extend` grows the window. Autoplay is now central in `PlayerContext` (`continueQueueEnd` tries vector ANN first, then Groq mix) — per-instance autoplay was removed to prevent hijacking.
- **Offline:** `OfflineBanner` (top pill, offline amber + online emerald 3s), `OfflineDownloadButton` (cloud-download icon), `GlobalDownloadBar` (top pill that *is* the overall 1/4 progress + thin byte bar), `DownloadsPage` (`/downloads`, auto-redirect when `navigator.onLine===false`), `offlineDB.ts` (IndexedDB `mellow-offline-v1`), `DownloadQueueContext` (sequential, CORS via `/api/offline-audio`, deduplicated, no retry storm).
- **Other UX:** `Vinyl` (grooved disc, spinning), `ArtworkPopup` (3D tilt + glare), `FullscreenPlayer` (blurred YouTube backdrop + Deezer hero), search engine picker (Deezer/iTunes/YouTube via `searchProvider.ts`, first-focus chooser), `TopNav` debounced search, `Sidebar` with Downloads/Liked/My Mix.

## Product rules for future agents

Do not do these unless explicitly requested:
- add login systems or real user accounts (anonymous `mellow_id` is the boundary)
- implement paid tiers or premium walls, ads, or SaaS pivots
- rewrite the backend framework without a clear requirement
- break the free/community-first philosophy

Prefer:
- preserve cache-first, low-latency, free-provider-first discovery
- keep the app backend-focused and modular, incremental fixes over large rewrites
- use vector + Groq hybrid for recommendations, not hallucinating track lists (LLM may only reorder supplied candidate IDs)

## File and dependency conventions

Backend `requirements.txt` / `pyproject.toml` (`backend/pyproject.toml` is the platform's source of truth, `requires-python ==3.13.*`, `tool.fastapi.entrypoint = "_server:app"`):
- `fastapi[standard]` (provides `fastapi` CLI), `uvicorn[standard]`
- `psycopg[binary]`, `pgvector` (vector branch), `mysql-connector-python`, `redis`
- `yt-dlp`, `spotipy`, `customisedLogs`, `rateLimitedQueues`, `randomisedString`, `autoReRun`, `cryptography`, `bidict` (legacy), `requests`, `colr==0.9.1`
- Embeddings: `fastembed`, `onnxruntime`, `sentence-transformers`, `torch` (torch is optional fallback, fastembed is preferred for memory)

Frontend `package.json`:
- `react`, `react-router-dom`, `axios`, `tailwindcss`, `vite-plugin-pwa`, `react-hot-toast`, `react-icons`, `nprogress`, `@vercel/analytics`

Static assets: `frontend/public/` is the PWA root (icons, og-image, robots, sitemap). `backend/Static/` legacy assets remain but are not used by the React app.

## Common failure points to avoid (updated)

- editing the wrong repo root or assuming only top-level folder matters (actual app is in `backend/` and `frontend/`)
- removing `Hidden/Secrets.py` references without updating the runtime contract (it is now committed and env-driven)
- `backend/Hidden/` is no longer fully gitignored — `Secrets.py` and `dynamicWebsite.py` are tracked; only `YT-COOKIES` stays ignored. `schema.sql` and `MySQLPool.py`/`PostgresPool.py` are tracked.
- `frontend/.env` `VITE_API_BASE_URL` is build-time — must redeploy frontend after changing it; `ALLOWED_ORIGINS` must include the Vercel URL
- `typing.io` removal in Python 3.13: `backend/_server.py` shims `typing.io` -> `typing` before any import; do not remove the shim
- `pyproject.toml` without `[project]` name breaks FastAPI Cloud builds (`Metadata field Name not found`); keep `setuptools.packages = []`
- `colr 0.9.0` breaks on 3.13 (`from typing.io`); `colr==0.9.1` is pinned
- `psycopg` missing from `pyproject.toml` causes `ModuleNotFoundError: No module named 'psycopg'` on vector branch deploys (platform builds from `pyproject.toml`, not `requirements.txt`)
- Vector branch OOM: `sentence_transformers` pulls `torch` (~400MB) at import time; `EmbeddingService` now lazy-imports and prefers `fastembed` ONNX, with `ENABLE_VECTOR=false` default to keep boot lean. Do not reintroduce top-level `import torch`.
- Postgres `timestamptz` vs naive `datetime.now()` — `SongProcessor` and `SongData` now use `timezone.utc` + `_ensure_aware` everywhere; do not revert to naive datetimes
- `YT-COOKIES` is gitignored — use `YT_COOKIES_B64` env on hosts; `YTDLP_PROXY` is the robust fix for datacenter bot checks (WebShare free works, Decodo $1.99 residential is the long-term)
- `googlevideo` has no ACAO — direct `fetch(AUDIO_URL)` from the browser will always CORS-fail; offline downloads must go via `GET /api/offline-audio/{songID}`
- `SongProcessor` uses `?` placeholders translated to `%s` in pools; both pools handle it, but do not switch to native `%s` in queries without updating the translation
- `index.html` / `sitemap.xml` / `robots.txt` canonicals must match the actual Vercel domain (`themellowmusic.vercel.app` vs `mellow-music.vercel.app`)
- `backend/Hidden/*` and `backend/Static/HTML/*` deletions in working tree are staged deletions — do not commit them without meaning to (they are still in git history)
- Vector branch was created with `--no-edit` merge of main, so history contains `Merge main into feat/vector-taste-recommendations` — keep merges explicit

## Commit and repo hygiene expectations

- Keep `.env` out of version control; keep commit messages clear
- Group logical changes into separate commits (see recent grouping: backend/hosting, vector, offline, PWA, etc.)
- Prefer project-level docs alignment before unrelated refactors
- Recent branching: `main` is stable for hosting; `feat/vector-taste-recommendations` is the vector taste engine (clean-slate Postgres, not merged); `feat/offline-shell` was merged into `main` as `7a40fe2`. New feature branches should branch from `main` unless they depend on vector.
- Operational mode: the user toggles between `plan` (read-only) and `build` (edits allowed). Respect the mode.

## Short summary for any future agent

This is a free music platform: FastAPI backend on Postgres (+ pgvector on the vector branch) with Redis cache, Deezer-first discovery via `YTDLP.py`, Groq-curated mixes via `MixCurator.py`, and a React + Vite + PWA frontend. Playback is prepare (`title` -> `ID`) then fetch (`ID` -> `AUDIO_URL` -> `<audio>`), never `/api/audio` except for offline proxy. The frontend has a dual-element crossfader, an anonymous taste signal system (`mellow_id` + `taste_events` + `song_embeddings`), an offline IndexedDB download queue with a global progress bar, and a daily watchdog (`/api/watchdog` -> `ntfy.sh`).

The important thing is to keep it simple, fast, free, and community-oriented. The backend is the foundation; the frontend is now equally real.

---

## Final instruction to agents

Before making major changes:
1. read this file
2. identify the right submodule and runtime contract
3. preserve the project philosophy: no login, no ads, free forever (anonymous taste only)
4. respect backend-first development but keep the PWA shell offline-capable
5. make the smallest correct change that solves the actual problem
6. do not hallucinate missing architecture or config

If this project is being extended, make changes that fit the current backend architecture (FastAPI, Postgres, Redis) and the product direction, not the generic SaaS template version of a music app.

## Handoff for the next session (2026-09-08)

**Where we left off:**
- Vector taste engine is feature-complete on `feat/vector-taste-recommendations` (Postgres clean slate, embeddings, `POST /api/taste/event`, `GET /api/recommend/vector`, real-time queue ANN with Groq fallback, affinity with decay). To go live, create an Aiven Postgres, enable `pgvector`, set `PGHOST/PGUSER/...` and `GROQ_API_KEY` + `ENABLE_VECTOR=true`.
- Main hosts the offline shell: `feat/offline-shell` was merged (`7a40fe2`). Offline downloads now go via `GET /api/offline-audio/{id}` (CORS proxy) with a sequential `DownloadQueueContext` and a global progress bar. The previous direct `fetch(googlevideo)` path is gone.
- The last bug fixed was `can't compare offset-naive and offset-aware datetimes` in `SongProcessor`/`SongData` — now all datetimes are `timezone.utc` aware.
- PWA + SEO are live (`themellowmusic.vercel.app`), watchdog pings `ntfy.sh` daily at 12:00, and hosting is green after the `psycopg`/`pyproject.toml` fix (version bumped to `1.0.1` to force a clean rebuild).

**Next planned batch (agreed, not started):**
1. Offline batch 2 (after the current shell): finalize offline UX polish, then plan the *songs* offline mechanism — IndexedDB is done, now wire `DownloadsPage` auto-redirect polish and quota handling, then discuss auto-caching Mix.
2. Full Spotify experience: Home `Playlists for your taste`, endless vector queue (already central with `onQueueExhausted` + `repeat-all` yielding to autoplay), and affinity-weighted taste (already in `taste.ts` + `affinity.ts`). The next step is to surface vector recommendations more broadly (Home sections, Explore) once the vector branch merges.

**To resume exactly where we are:**
- Branch `feat/vector-taste-recommendations` is the active vector work (contains `PostgresPool`, `EmbeddingService`, `schema.sql` with vector, and frontend `anonymous.ts`/`taste.ts`). `main` is the stable offline/PWA track. Pick the branch that matches the next task.
- Local Postgres for vector: `postgres/mellow@123/mellow_music` on `localhost:5432` with `vector` extension (fallback to TEXT + Python brute-force works on Windows).
- Env template is in `.env.example` (now includes `PGHOST`, `GROQ_MODEL`, `YT_COOKIES_B64`, `YTDLP_PROXY`, `NTFY_TOPIC`, `ENABLE_VECTOR`). Never commit real secrets.
- Build checks: `.\.venv\Scripts\python.exe backend\_server.py` (or `uvicorn`), `npm --prefix frontend run build` (PWA 43-48 precached entries). Backend syntax: `python -c "import ast; ast.parse(open('backend/_server.py').read())"`.
