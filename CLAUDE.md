# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Learning Path Generator ("LearnAnything") — a full-stack app that uses OpenAI's GPT API to generate structured learning paths for any topic. Monorepo with a React frontend (`client/`) and a FastAPI backend (`server/`).

## Development Commands

### Backend (`server/`)
```bash
uv sync                          # Install dependencies
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  # Run dev server
make test                        # Run all tests (pytest)
uv run pytest tests/test_routers_learning_paths.py  # Run a single test file
uv run pytest -k "test_name"     # Run a single test by name
make format                      # Auto-format with ruff
make lint                        # Check formatting + lint
make check                       # lint + test
```

### Frontend (`client/`)
```bash
npm install      # Install dependencies
npm run dev      # Dev server at http://localhost:3000
npm run build    # Production build
npm run test     # Run tests (vitest)
npm run test:watch  # Watch mode
```

### Docker
```bash
docker compose up --build   # Run full stack (FE :3000, BE :8000)
```

## Architecture

### Backend (`server/app/`)
FastAPI app with layered structure:
- `main.py` — App wiring: CORS, rate limiting (slowapi), router mounting
- `api/router.py` — Aggregates all routes under `/v1` prefix
- `routers/` — Endpoint handlers: `learning_paths.py` (POST `/v1/lp/{topic}`), `stats.py` (GET `/v1/stats`)
- `services/` — Business logic: `learning_path_service.py` (OpenAI calls), `counter_service.py` (generation counter, noop or Firestore)
- `schemas/` — Pydantic models for request/response validation
- `core/config.py` — `Settings` class loaded from env vars (cached via `@lru_cache`). Reads `.env` in non-production
- `core/security.py` — API key auth (`X-API-Key` header) + rate limiter. Auth enforced when `REQUIRE_API_KEY=true`

### Frontend (`client/src/`)
React 19 + Vite SPA:
- `config/api.js` — Centralized API base URL resolution (`VITE_API_BASE_URL`). In dev hits `localhost:8000` directly; in prod hits `/api` (Vercel proxy)
- `pages/LearningPath/` — Main feature: renders generated learning path
- `pages/HomePage/` — Search input for topics
- `components/` — Shared UI: NavBar, Searchbar, Button
- `client/api/` — Vercel serverless proxy routes (`v1/lp/[topic].js`, `v1/stats.js`) that forward requests to Cloud Run with `X-API-Key`, keeping secrets server-side

### Request Flow
Browser → Vercel client → Vercel API proxy (adds `X-API-Key`) → Cloud Run backend → OpenAI API + Firestore

In local dev, the frontend calls the backend directly (no proxy needed).

## Key Environment Variables

### Backend
- `OPENAI_API_KEY` — Required (except in test env where it auto-fills)
- `API_KEY` / `REQUIRE_API_KEY` — Backend auth (enabled by default in production)
- `CORS_ORIGINS` — Comma-separated allowed origins (must be explicit in production)
- `COUNTER_BACKEND` — `noop` (default) or `firestore`
- `LP_RATE_LIMIT` / `STATS_RATE_LIMIT` — Rate limit strings (e.g. `15/minute`)

### Frontend
- `VITE_API_BASE_URL` — API target. Set in `.env.development` (localhost) and Vercel env (prod)
- `BACKEND_BASE_URL` / `BACKEND_API_KEY` — Vercel serverless-only, never exposed to browser

## Deployment
- **Frontend**: Vercel (root directory: `client`, framework: Vite). `dev` → Preview, `main` → Production
- **Backend**: Google Cloud Run. See `DEPLOY.md` for full E2E deployment guide
- **Branching**: Work on `dev`, PR to `main` for production

## Tech Stack
- **Backend**: Python 3.12, FastAPI, OpenAI SDK, Pydantic, slowapi, Firestore, uv, ruff
- **Frontend**: React 19, Vite, React Bootstrap, MUI, notistack, Sass, react-router-dom
- **Testing**: pytest + pytest-asyncio (backend), vitest + testing-library (frontend)
