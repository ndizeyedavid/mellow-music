# AGENTS.md

This file exists so future coding agents do not guess, hallucinate, or rewrite the project around the wrong mental model.

## Project identity

Mellow Music is a community-first, no-login, no-account, ad-free music project built around a simple idea:

- free forever
- no accounts
- no paywall for basic access
- no ads
- backend-first architecture
- web app first, mobile app later

This project is intended to be useful and respectful, not to become a dark-pattern startup with login walls and monetization nonsense.

## Important project facts

### Repository structure

The repo root is:

- `C:\Users\MELLOW\Desktop\Projects\mellow-music`

Important folders:

- `backend/` — actual app code and runtime files
- `frontend/` — React web app (Vite + React 19 + Tailwind CSS v4)
- `README.md` — public project overview
- `.env` — local runtime environment variables for this machine
- `.env.example` — template for required env vars
- `.venv/` — local Python environment

Important runtime files inside `backend/`:

- `backend/_server.py` — main server entrypoint and Flask app setup
- `backend/MusicAPI_servers.py` — secondary server-related helpers if present
- `backend/Classes/Processors/YTDLP.py` — core discovery/search logic and cache behavior
- `backend/Classes/Processors/SongProcessor.py` — DB and in-memory song handling
- `backend/Classes/Processors/DBHolder.py` — database connection and pool logic
- `backend/Classes/Holders/FileInvolved.py` — static file and folder mapping
- `backend/Hidden/Secrets.py` — secrets and app constants
- `backend/Hidden/dynamicWebsite.py` — custom dynamic web interface implementation
- `backend/Static/HTML/` — UI templates
- `backend/requirements.txt` — Python dependencies

## Core architecture

### 1) Backend-first product

The app is a FastAPI-based service (`backend/_server.py`) served with uvicorn on port `10020` (see `CoreValues.webPort`). It runs with gevent-style async streaming for audio.

The backend is the real product. UI work should not be prioritized over API stability, discovery flow, or cache correctness.

### 2) Search and discovery pipeline

The search/discovery layer is centered in `backend/Classes/Processors/YTDLP.py`.

Current intended behavior:

- prefer free metadata sources first
- use local cache before slow external calls
- keep stale results available while a background refresh runs
- use YouTube only as a fallback when free providers are missing or weak

This project intentionally avoids locking the experience behind paid providers or a broken expensive flow.

### 3) Cache strategy

The app does a cache-first pattern:

- Redis is used when available
- in-memory cache is used as local fallback
- stale results are served immediately if available
- background refresh fills newer values without blocking the request path

This is important for responsiveness and to reduce network dependency during search/homepage requests.

### 4) Song preparation pipeline

`SongCache` in `backend/Classes/Processors/SongProcessor.py` handles:

- song lookup by name or URL
- DB alias matching
- new song preparation
- metadata refresh and expiry logic
- caching in memory and DB-backed persistence

This component sits between the public API and the discovery backends.

### 5) Public API shape

Public API routes are defined in `backend/_server.py`.

Important endpoints:

- `/api/prepare/<string>` — returns a song ID for a provided name or URL: `{"ID": "<30-char id>"}`
- `/api/fetch/<songID>` — returns full song metadata: `{ID, SONG_NAME, YT_ID, SPOTIFY_ID, DURATION, AUDIO_URL, THUMBNAIL, EXPIRY, LYRICS}`
- `/api/audio/<songID>` — streams the audio payload (`audio/mpeg`), blocking until the song is prepared
- `/api/home` — homepage discovery results: `{"results": [{id, title, artist, thumbnail, duration, url}]}`
- `/api/search?q=&max_results=` — generic search endpoint: `{"results": [{id, title, artist, thumbnail, duration, url}]}`
- `/health` — backend reachability probe: `{"status": "ok"}`

These endpoints are the primary integration points for the web app or future mobile app.

## Frontend (`frontend/`)

The web app is a Vite + React 19 + Tailwind CSS v4 project using `react-router-dom` v7 and `axios`.

### Structure

- `src/api/client.ts` — shared axios instance (`VITE_API_BASE_URL`, empty = same origin)
- `src/api/music.ts` — typed backend calls + adapters (`getHome`, `searchTracks`, `prepareSong`, `audioUrl`, `toTrack`)
- `src/api/connectivity.ts` — framework-free online/backend reachability store
- `src/context/ConnectivityContext.tsx` — React wiring for the store + health pings + `useConnectivity()`
- `src/context/PlayerContext.tsx` — audio state + `playResults(results, startIndex)` which prepares songs and points the queue at `/api/audio/<ID>`
- `src/utils/localCache.ts` — localStorage cache (`mellow-cache:*`) for home/search fallback
- `src/components/` — reusable UI; `src/data/` — local seed catalog used as offline fallback

### Integration behavior

- Dev: Vite proxies `/api` to `http://localhost:10020` (see `vite.config.ts`). Prod: set `VITE_API_BASE_URL`.
- Home + Search are live backend calls; on failure they serve the last cached payload, then the local catalog.
- A slim `ConnectivityBanner` shows when the network is off or the backend is unreachable.
- Playback: `playResults` calls `/api/prepare/<name-or-url>` for each result, then streams `/api/audio/<songID>`. If unreachable, tracks fall back to `public/demo.mp3`.
- Local state (likes, follows, saved albums, playlists, volume) lives in localStorage only.
- Verification: `npm run lint` and `npm run build` (TypeScript). No browser-based smoke testing.

## Environment variables

The project expects environment variables at the repo root in `.env`.

Current known keys:

- `MELLOW_REDIS_URL`
- `REDIS_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Example values:

```env
MELLOW_REDIS_URL=redis://localhost:6379
REDIS_URL=redis://localhost:6379

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mellow_music
```

Important rules:

- never commit real secrets
- use `.env` only for local environment values
- `.env.example` is the safe template version for the repo
- if credentials differ per environment, they must be set at deploy time, not hardcoded in source

## Secrets and config expectations

`backend/Hidden/Secrets.py` contains app-specific values including:

- Fernet key for secure web values
- app name and port config
- DB host/user/password/database values in the project’s current implementation
- required file list for the backend

This file is not meant to be treated as an optional config file. It is part of the runtime contract.

When making changes:

- do not delete required values without checking the app code that depends on them
- keep `CoreValues.webPort` and `CoreValues.webRoute` consistent with the app runtime
- do not rename critical constants casually

## Local startup

Use the project root and then the app under `backend/`.

### Example commands

```powershell
# from project root
.\.venv\Scripts\python.exe backend\_server.py
```

or:

```bash
python backend/_server.py
```

The server is configured for local port `10020` by default.

## Web and UI model

Two UIs exist:

- `frontend/` — the modern React web app (Vite + React 19 + Tailwind v4). This is the primary web client and talks to the backend through axios (see "Frontend" above).
- `backend/Hidden/dynamicWebsite.py` + `backend/Static/HTML/` — the legacy server-rendered pages, still mapped by `backend/Classes/Holders/FileInvolved.py`.

The stated direction is:

1. backend stability first
2. web version after backend is reliable
3. React Native app after web is in sync

## Product rules for future agents

### Do not do these unless explicitly requested

- add login systems or user accounts
- implement paid tiers or premium walls
- add ads or monetization layers
- pivot the project toward a SaaS-style account model
- rewrite the backend into a newer framework without a clear requirement
- break the free/community-first product philosophy

### Prefer these behaviors

- preserve cache-first, low-latency patterns
- maintain free discovery options before paid or proprietary data sources
- keep app behavior simple and stable
- keep the app backend-focused and modular
- prefer incremental fixes over large rewrites

## File and dependency conventions

### Python package expectations

`backend/requirements.txt` includes:

- Flask and Flask Sock
- gevent
- Jinja2
- mysql-connector-python
- pooledMySQL
- yt-dlp
- spotipy
- customisedLogs
- rateLimitedQueues
- randomisedString
- autoReRun
- cryptography
- bidict
- requests

These are not random extras; they are part of the current runtime stack.

### Static assets

Static files and HTML are served from `backend/Static/`.

The project currently expects rendered HTML templates and JS helpers to exist under the static tree. If they are missing, the app behavior can degrade even when the Python backend is otherwise fine.

## Common failure points to avoid

- editing the wrong repo root
- assuming the project is only in the top-level folder when the actual backend is in `backend/`
- removing `Hidden/Secrets.py` references without updating the runtime contract
- adding login/account features against the product vision
- assuming YouTube is the primary discovery layer when the architecture aims for free-provider-first discovery
- forcing frontend work before the backend is stable

## Commit and repo hygiene expectations

This repo should be treated as a real project with a clean public-facing history.

Rules:

- keep `.env` out of version control for real secrets
- keep commit messages clear and specific
- group logical changes into separate commits when possible
- prefer project-level docs and config alignment before unrelated refactors

## Short summary for any future agent

This is a free music backend and platform project with a strong no-login philosophy. It is built around a Python Flask backend, MySQL persistence, Redis caching, discovery logic in `YTDLP.py`, and a web-first product roadmap that eventually leads to a React Native mobile app.

The important thing is not to over-engineer it. The project is meant to stay simple, fast, free, community-oriented, and lightly opinionated. Do not rewrite it around account systems, ad models, or front-end-first chaos. The backend is the foundation.

---

## Final instruction to agents

Before making major changes:

1. read this file
2. identify the right submodule and runtime contract
3. preserve the project philosophy: no login, no ads, free forever
4. respect backend-first development
5. make the smallest correct change that solves the actual problem
6. do not hallucinate missing architecture or config

If this project is being extended, make changes that fit the current backend architecture and the product direction, not the generic SaaS template version of a music app.
