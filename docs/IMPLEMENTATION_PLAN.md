# FastAPI migration plan for API-only backend

This plan isolates the delicate migration work onto its own branch and intentionally removes the old HTML-serving web app behavior from the backend scope.

## Goal

Migrate the project from the current Flask-based backend to a FastAPI backend that is API-only, backend-first, and suitable for a separate future UI project. The backend should expose clean JSON endpoints and stop serving HTML pages or browser-rendered app shells.

## Non-goals

- Do not build the UI in this backend repository.
- Do not keep server-rendered HTML routes as part of the long-term product contract.
- Do not add login/account flows.
- Do not introduce paid walls or ads.
- Do not rewrite the product vision or the no-login philosophy.

## Core decisions

### 1) API-only backend

The backend should serve JSON and stream data only. The old dynamic HTML / browser-rendered web app is considered legacy and should be removed from the active backend direction.

This means:

- `/api/*` remains the primary integration layer
- no dynamic page rendering from Flask or custom HTML templates in the runtime path
- no server-side page generation for the main product experience
- UI work happens in a separate frontend directory/app later

### 2) Keep business logic stable

The project has working music discovery and cache logic. We should not rewrite the entire app in one shot. Instead, we should move the core logic into modules that can be used by FastAPI without changing the product behavior.

### 3) Preserve the product contract

The following behaviors must remain stable:

- search and home discovery endpoints
- song prepare/fetch flow
- audio stream responses
- cache-first and stale refresh behavior
- no-login, free forever, community-first behavior

### 4) Keep deployment lightweight

The migration should be compatible with a free hosting environment that does not keep the service alive forever, but does support a lightweight app runtime and stable API behavior.

## Target architecture

### New backend shape

- FastAPI application entrypoint
- route modules for API endpoints
- service layer for:
  - discovery
  - cache
  - metadata preparation
  - song lookup
  - audio access
- shared config via environment variables
- DB access via existing MySQL patterns
- optional Redis cache support as currently implemented

### Keep the existing logic where it still makes sense

Keep and adapt the current project assets that are relevant to runtime behavior:

- `backend/Classes/Processors/YTDLP.py`
- `backend/Classes/Processors/SongProcessor.py`
- `backend/Classes/Processors/DBHolder.py`
- `backend/Classes/Holders/FileInvolved.py` if needed for static assets
- `backend/Hidden/Secrets.py` / env config structures

Remove or ignore the browser app pieces not needed for API-only usage, especially:

- custom dynamic web app routes
- dynamic HTML renderer flow
- server-side page templates as primary interface
- legacy `/cd` and HTML-serving behavior

## Migration phases

### Phase 1: freeze the current API contract

Before code changes, map the current public endpoints and outputs.

Checklist:

- `/api/prepare/<string>`
- `/api/fetch/<songID>`
- `/api/audio/<songID>`
- `/api/home`
- `/api/search?q=...`

Capture:

- request shapes
- response JSON fields
- error handling
- expected status codes
- streaming behavior

### Phase 2: isolate core services from Flask-specific code

Refactor business logic so it does not depend on Flask request objects or server-rendered templates.

Key tasks:

- move config usage to environment-based settings
- isolate `SongCache` logic from UI concerns
- ensure discovery and prepare logic works without dynamic web routes
- keep DB and cache behavior intact

### Phase 3: create FastAPI app shell

Create a new FastAPI app entrypoint and mirror the routes.

Requirements:

- same endpoint names and JSON structures
- no HTML pages or dynamic server-rendered UI
- clean startup and health route via environment config
- support for local dev and hosted deployment

### Phase 4: remove legacy web-serving behavior

Delete or disable legacy HTML-serving code paths.

This includes:

- dynamic website app setup
- custom page renderer wiring
- legacy HTML template references from main app flow
- any route used only for server-rendered UI

### Phase 5: test real behavior against the API

This is required before concluding the migration is safe.

Test cases:

- search query returns list of results
- home endpoint returns expected cards
- prepare endpoint returns a valid song ID
- fetch endpoint returns expected metadata shape
- audio endpoint streams successfully
- stale cache behavior still works

### Phase 6: deployment clean-up

After API checks pass:

- ensure env config matches deployment environment
- remove deprecated server-side UI assumptions from docs
- keep README and AGENTS.md aligned with the API-first direction

## Specific backend cleanup to do

### Remove / de-prioritize

- server-side HTML routes
- dynamic rendering of templates
- custom web page startup flow
- browser UI and websocket page functionality tied to the main app
- `/cd` serving JS assets from app-specific static paths for legacy UI

### Keep

- JSON endpoints
- discovery logic
- cache logic
- DB access
- audio streaming
- background refresh behavior

## Risk areas to watch

- response structure differences between Flask and FastAPI
- DB connection handling and lifecycle
- Redis/cache timeout behavior
- streaming audio may need explicit response handling
- background threads and event wait logic must be carefully preserved
- custom dynamic web assumptions should not be carried over silently

## Implementation constraints

- no new account system
- no login flow
- no ads or monetization features
- no broad rewrite beyond the migration scope
- do not convert the project into a generic SaaS template
- keep the app free and community-first

## Success criteria

The migration is successful when:

- the project runs as an API-only FastAPI app
- the same core backend features keep working
- HTML page serving is removed from the product direction
- the app is ready for a separate UI project to consume JSON APIs
- the public and internal docs reflect the new backend-first architecture

## Approval gate

This plan is the first thing on the branch. It should be reviewed and approved before implementation starts. After approval, the code migration begins in small, testable steps.
