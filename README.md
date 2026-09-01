<div align="center">

# Mellow Music

[![No Login](https://img.shields.io/badge/auth-no%20login%20required-FF6F00?style=for-the-badge)](https://github.com/ndizeyedavid/mellow-music)
[![No Ads](https://img.shields.io/badge/ads-zero%20ads-1976D2?style=for-the-badge)](https://github.com/ndizeyedavid/mellow-music)
[![Platform](https://img.shields.io/badge/platform-web%20%2B%20React%20Native-121212?style=for-the-badge)](https://github.com/ndizeyedavid/mellow-music)
[![Stack](https://img.shields.io/badge/stack-python%20%7C%20flask%20%7C%20mysql-3776AB?style=for-the-badge)](https://github.com/ndizeyedavid/mellow-music)

</div>

> Mellow Music is a community-first music platform built for people who are tired of the usual nonsense: no accounts, no paywalls, no creepy ads, no “please sign in to hear your own music” energy.
>
> It is free, fast, and designed to be useful without being annoying. Basically: music without the corporate circus.

## Why this exists

Because the world already has enough apps asking for your email, your phone number, your firstborn, and 14 permissions just to play a track.

Mellow Music is built around a very simple idea:

- no login
- no account creation
- no paid wall for basic usage
- no ads
- no stress
- no drama

This project is for the community, by the community, and it stays free forever. If we can help people discover and enjoy music without turning them into a product, that is a win.

---

## The mission

We are building a music ecosystem that is:

- easy to use
- fast enough to feel alive
- open enough to grow without locking users in
- respectful of privacy
- sustainable without selling user attention to the highest bidder

In short: music should be a vibe, not a business model with 18 pop-ups.

---

## Product direction

We are not trying to reinvent the music industry in one dramatic midnight release. That would be chaotic and deeply unserious.

We are doing this in phases.

| Phase   | Goal                                                              | Status      |
| ------- | ----------------------------------------------------------------- | ----------- |
| Phase 1 | Build a stable backend and discovery pipeline                     | In progress |
| Phase 2 | Deliver a clean web experience                                    | Next up     |
| Phase 3 | Sync the backend with the web app and optimize UX                 | Planned     |
| Phase 4 | Build the mobile app in React Native                              | Planned     |
| Phase 5 | Scale community features without breaking the no-login philosophy | Future      |

### The approach

1. Backend first. This is the engine room.
2. Stable metadata and discovery flow before any UI sparkle.
3. Web app once the backend is reliable.
4. Mobile app after the web version is proven.
5. Keep it community-oriented and free, not “growth-hacked to death.”

---

## Current architecture

| Layer     | Stack                                          | Purpose                                 |
| --------- | ---------------------------------------------- | --------------------------------------- |
| Backend   | Python, Flask, gevent                          | API layer and server runtime            |
| Database  | MySQL                                          | Metadata and caching storage            |
| Discovery | yt-dlp, Deezer, iTunes, Last.fm-style fallback | Search / homepage discovery             |
| Cache     | Redis                                          | Fast response caching and stale refresh |
| Frontend  | HTML / JS web UI                               | Browser experience                      |
| Mobile    | React Native                                   | Planned cross-platform app              |

This is a modular backend-first system designed to stay fast, flexible, and independent from any one noisy provider.

---

## Core principles

### 1) No accounts. No nonsense.

The project is designed so users can use the service without creating an account, logging in, or handing over personal data just to play music.

### 2) Free forever

This project is not trying to become another “free trial disguised as freedom” product. The goal is a genuinely free music service.

### 3) No ads, no stress

If a music app needs to trap attention with ads and dark patterns to survive, it is not a real music app. It is an attention farm with speakers.

### 4) Backend first, UI second

The backend is the real business. If the API is stable, the web and mobile experiences are easier to build without breaking the core system.

### 5) Community value before vanity metrics

We are building something useful, not something designed to win a startup pitch deck by pretending to be a lifestyle brand.

---

## Feature direction

### Already in motion

- backend music search and metadata retrieval
- song preparation and fetch endpoints
- cache-aware fast responses
- background refresh and fallback discovery
- local Redis-backed caching support
- free discovery path without forcing everything through a paid model

### Next goals

- polished web interface
- better homepage/search experience
- reliable cross-provider fallback chain
- lower latency and smarter caching behavior
- mobile-ready API design

### Future goals

- React Native mobile app
- better offline-friendly behavior
- manageable public API access for community use
- more discovery polish without sacrificing simplicity

---

## Project structure

```text
mellow-music/
├─ .env.example
├─ .env
├─ .gitignore
├─ README.md
├─ backend/
│  ├─ _server.py
│  ├─ MusicAPI_servers.py
│  ├─ requirements.txt
│  ├─ README.md
│  ├─ Classes/
│  ├─ Hidden/
│  ├─ Static/
│  └─ Temp/
└─ .venv/
```

---

## Tech stack

### Backend

- Python
- Flask
- gevent
- Jinja2
- MySQL Connector
- Redis
- yt-dlp
- requests
- cryptography

### Planned frontend / app stack

- React / Next-style web frontend
- React Native for mobile
- API-driven architecture
- cache-first design

---

## Local setup

Use the repo root and the backend environment for local development.

```bash
# create a virtual environment
python -m venv .venv

# activate it
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# install dependencies
pip install -r backend/requirements.txt

# copy env file
cp .env.example .env

# make sure Redis is available locally
# default used by the project:
# redis://localhost:6379
```

### Run the backend

From the project root, activate the environment and start the API server:

```powershell
# PowerShell
(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned)
& ".\.venv\Scripts\Activate.ps1"
& ".\.venv\Scripts\python.exe" -m uvicorn backend._server:app --host 0.0.0.0 --port 10020
```

Alternative direct run:

```powershell
& ".\.venv\Scripts\python.exe" .\backend\_server.py
```

Then open:

- http://127.0.0.1:10020/
- http://127.0.0.1:10020/docs
- http://127.0.0.1:10020/api/search?q=eminem

If you are doing local development, keep the environment values in the root `.env` file. No need to over-engineer it. The app already knows the local pattern.

---

## Roadmap

### Phase 1 — Backend is the boss

We are building the actual engine: reliable fetching, metadata handling, caching, and search. This is the part nobody sees, but it is the part that decides whether the whole thing becomes a useful product or a sad glitchy prototype.

### Phase 2 — Web version

Once the backend feels stable, we move to a clean browser experience with a lightweight UI that is fast, minimal, and respectful of user time.

### Phase 3 — Mobile app

After the web version is working properly, we build the React Native mobile app so the same backend powers a modern mobile experience without waking up the corporate nonsense machine.

### Phase 4 — Community growth

Then we keep improving the platform in a way that stays ad-free, account-free, and useful.

---

## What we are not doing

This project is not going to become:

- a login trap
- a paid-tier disguised as “premium”
- an ad-ridden data-harvesting machine
- a product that monetizes by making users feel like they owe the app their soul

No thanks. We are building something better.

---

## Contributions

Contributions are welcome as long as they respect the project vision:

- keep it free
- keep it simple
- keep it respectful
- keep it useful
- no fake “growth” nonsense

If you want to help, open an issue, suggest ideas, or help improve the backend and discovery layers. The goal is to make the project better without turning it into a corporate maze.

---

## Massive shoutout

Huge respect and a proper thank-you to the original builder who laid the foundation for this whole thing:

- [BhaskarPanja93](https://github.com/BhaskarPanja93)
- Original repo: [BhariyaMusic](https://github.com/BhaskarPanja93/BhariyaMusic)

This project would not exist in this form without the groundwork, idea, and starting point they gave the community. We are standing on their foundation, iterating on it, and trying to push the idea forward without the usual nonsense.

This is not a “we invented everything ourselves” situation. This is a remix with respect, a bit of chaos, and a lot of gratitude.

---

## Final thought

Mellow Music is not trying to be another polished startup pretending to save the world. It is trying to be a music project that actually respects people.

No login. No ads. No nonsense. Just music, with some good engineering and a little bit of chaos in the best possible way.

If the internet had dignity, this project would be that.

---

<div align="center">

Made with a bit of chaos, a bit of code, and a lot of respect for the people who just want to play music without the circus.

</div>
