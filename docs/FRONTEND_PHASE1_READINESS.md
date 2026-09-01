# Frontend Phase-1 Readiness Review

**Status: reviewed against `npm run lint` + `npm run build` (both green). No browser testing.**
Date: 2026-08-31 · Branch: `frontend/web-player`

---

## 1. Verdict

The frontend is a solid, well-structured **static demo** of the product. It is **not yet ready to integrate the backend** without first adding a real data-fetching layer, wiring the player to the streaming API, enabling TypeScript strict mode, and adding loading/error handling.

Everything below is grouped by priority. Items marked **[BLOCKER]** should be done before any backend work starts.

---

## 2. What is already solid ✅

- **Component architecture**: reusable components in `src/components/`, contexts (`PlayerContext`, `PlaylistContext`), hooks (`useAudioPlayer`), data in `src/data/`, pages in `src/pages/`.
- **Routing**: `react-router-dom` v7 with routes for `/`, `/explore`, `/search`, `/playlists`, `/playlist/:id`, `/albums`, `/album/:id`, `/tracks`, `/artists`, `/artist/:id`, `/song/:id`.
- **Playback engine**: `useAudioPlayer` supports play/pause, seek, volume, mute, shuffle, repeat, prev/next, and **dynamic queue replacement** (`replaceQueue`) — the key hook pages will use when real tracks arrive.
- **Design system**: Tailwind v4 tokens in `index.css` match the Figma spec; dark scrollbars, Inter font.
- **No video references remain** (grep verified) — audio-only platform as required.
- **Lint + type-check pass** after this review's fixes (7 lint errors fixed, see §7).

---

## 3. Blockers — fix before backend integration 🔴

### 3.1 No API/data-fetching layer at all
- All content lives in hardcoded arrays (`src/data/catalog.ts`: songs, albums, artists, playlists).
- There is **zero** `fetch`, no `axios`, no React Query, no api client module.
- **Action**: create `src/api/` with:
  - a typed `apiClient` (base URL from `import.meta.env.VITE_API_BASE_URL`, timeout, error normalization),
  - per-domain functions (`getHome`, `getSearch`, `getAlbum`, `getArtist`, `getSong`, `getPlaylists`, …) matching backend routes,
  - an **adapter layer** mapping backend DTOs → the frontend `Track`/`Album`/`Artist`/`Playlist` types so pages don't change when data goes live.
- Consider `@tanstack/react-query` for caching/stale-while-revalidate (matches the cache-first philosophy of the backend).

### 3.2 No loading / error / empty states
- Every page renders static data synchronously. The moment data comes from HTTP, every page will flash empty or crash.
- **Action**: add a small `Async`/`useQuery` pattern (or a `PageState` component) with `loading`, `error` (with retry), and `empty` states; wrap route content in an error boundary.

### 3.3 TypeScript strict mode is OFF
- `tsconfig.app.json` has no `"strict": true`. This is the biggest correctness risk — `null`/`undefined` and implicit-any bugs can slip through.
- **Action**: enable `"strict": true` (and `noUncheckedIndexedAccess`) and fix the fallout before the API layer multiplies type surface.

### 3.4 No env config or dev proxy
- No `.env` / `.env.example` in `frontend/`; no `VITE_API_BASE_URL`.
- `vite.config.ts` only ignores `*.mp3` from the watcher — **no `server.proxy`**.
- **Action**:
  - add `frontend/.env.example` with `VITE_API_BASE_URL`,
  - add a Vite dev proxy (e.g. `/api` → `http://localhost:10020`) so dev hits the real backend without CORS issues,
  - document CORS handling on the backend (the Flask/FastAPI side must allow the frontend origin in dev).

### 3.5 Player audio source is hardcoded
- `useAudioPlayer` streams `src/data/catalog.ts` `source: "/demo.mp3"` for every track.
- **Action**: wire the player's `replaceQueue`/track objects to stream `/api/audio/<songID>` (per AGENTS.md). Keep `/demo.mp3` only as a fallback/offline demo.
- Add `onError` handling on the `<audio>` element (failed stream → toast + auto-skip).

### 3.6 State is entirely ephemeral
- `liked`, `following`, album `saved`, playlist create/edit/delete/reorder — **all lost on refresh** (no `localStorage`, no Media Session, no backend).
- **Action**: introduce a `usePersistentState` (localStorage) now for likes/follows/saved albums/playlists + volume + last queue. Swap the storage adapter to the backend later (no-login philosophy → likely device/anon ID or nothing; decide with the backend team).

---

## 4. Important quality gaps — do before launch 🟠

- **Mobile navigation**: sidebar is `hidden lg:flex` → below 1024px there is **no nav** (no drawer). Top-nav "back" only. Needs a mobile menu (slide-over) before any real user testing on phones.
- **Route-level code splitting**: single bundle ~314 KB JS. Use `React.lazy()` per page (cheap win, big perceived-perf win on a music app).
- **Route titles**: no per-route `document.title` (SEO + UX).
- **Search**: live URL navigation on every keystroke works now (small static set) but will need **debounce** + backend search + abort previous requests once `/api/search` is live. Empty-query state currently = "Browse all" (good, keep).
- **Audio UX polish**:
  - no keyboard shortcuts (Space = play/pause),
  - no Media Session API (lock-screen / OS media controls),
  - volume not persisted,
  - no buffering/loading indicator on seek/stream switch,
  - no "audio failed" state.
- **Image handling**: every entity uses one of 20 demo PNGs. Real backend art → need `onError` fallback, proper `alt`, and `width/height` hints to stop layout shift.
- **Accessibility**: aria-labels are mostly good; missing: skip-link, consistent `:focus-visible`, `aria-current` on SongRow active, semantic table for Tracks (currently `ul/li`). Add a quick a11y pass.
- **Playlist model is client-only**: `PlaylistContext` seeds from static data and resets on reload. Define the backend contract for playlists (user-scoped but **no accounts** → clarify ownership model before building).

---

## 5. Housekeeping 🟡

- `nprogress` (`^0.2.0`) is in `package.json` but **never imported** — either wire it into route transitions or remove it.
- Fast-refresh lint rule suppressed on `PlayerContext`/`PlaylistContext` (`// eslint-disable-next-line react-refresh/only-export-components`) because each file exports a hook + provider. Cleaner: split hooks into `usePlayer.ts` / `usePlaylists.ts`. Low priority, DX only.
- No test setup (Vitest + RTL). Add smoke tests for the player hook and routing before the API layer lands.
- `ExplorePage` hero section is currently absent (removed earlier); `/` and `/explore` render identical content — intentional? Confirm.

---

## 6. Backend integration contract (from `AGENTS.md`)

| Frontend need            | Backend endpoint                                  | Status today              |
| ------------------------ | ------------------------------------------------- | ------------------------- |
| Homepage discovery       | `GET /api/home`                                   | not consumed              |
| Search (live results)    | `GET /api/search?q=`                              | static filter only        |
| Resolve name/URL → song  | `GET /api/prepare/<string>`                       | —                         |
| Song metadata            | `GET /api/fetch/<songID>`                         | static `catalog.ts`       |
| Audio streaming          | `GET /api/audio/<songID>`                         | `/demo.mp3` hardcoded     |

The adapter layer (§3.1) should map these DTOs into the existing frontend types so all 11 pages keep working unchanged.

---

## 7. Fixes applied during this review

1. `TopNav` — removed `setState`-in-`useEffect`; query now derived directly from the URL (single source of truth).
2. `ExplorePage` — removed unused icon imports + unused `toggleShuffle`.
3. `AlbumPage` — `Math.random()` moved out of render into the shuffle handler (component purity).
4. `PlayerContext`/`PlaylistContext` — suppressed fast-refresh rule on hook exports (see §5).

`npm run lint` → 0 errors. `npm run build` → clean.

---

## 8. Recommended phase-2 order

1. Enable TS strict + add `.env.example` + Vite proxy (small, unblocks everything).
2. Build `src/api/` client + adapters + `PageState` (loading/error/empty) + error boundary.
3. Wire `useAudioPlayer` to `/api/audio/<id>` + audio error handling + Media Session + keyboard shortcuts.
4. Persist user state (likes/follows/saved/playlists/volume) — localStorage now, backend later.
5. Route lazy-loading + document titles + mobile nav drawer.
6. Search: debounce + backend integration.
7. Tests (player hook + routing smoke) + a11y pass.
8. Remove unused `nprogress` or use it.
