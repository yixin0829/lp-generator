# Learning Path Generator

## 1 Goal
Help people learn faster and more efficiently to reach their learning goal. LearnAnything's mission is to facilitate the consolidation of the world's knowledge sharing by creating a place where users can share their learning experiences and knowledge with others.

## 2 Overview
Why did we build LearnAnything? You might ask. Well, we want you to think of LearnAnything as more than just a learning path generator, but as an entry point for YOU to begin your learning journey on any topic that you could possibly imagine. Just as Mahatma Gandhi once said, "Live as if you were to die tomorrow. Learn as if you were to live forever."

## 3 How to Run
### 3.1 Local (without Docker)
- Backend
    - `cd server`
    - `uv sync`
    - Set `OPENAI_API_KEY` in your shell or `.env`
    - Optional: set `CORS_ORIGINS=http://localhost:3000` (comma-separated list supported)
    - Optional: set `CACHE_BACKEND=firestore` to enable learning path caching (default: `noop` — no caching)
    - Optional: set `SHARE_BACKEND=firestore` to enable immutable unlisted share links. Identical snapshots reuse the same content-addressed URL (default: `noop` — sharing disabled)
    - Start API: `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend
    - `cd client`
    - `npm install`
    - `npm run dev`
    - App runs at `http://localhost:3000`
- API base URL config
    - `client/.env.development` defaults to `VITE_API_BASE_URL=http://localhost:8000`
    - Local FE+BE flow should call `http://localhost:8000/v1/lp/{term}`

### 3.2 Frontend Production Env (Vercel)
- The browser never calls Cloud Run directly. `client/.env.production` sets `VITE_API_BASE_URL=/api` (browser → Vercel serverless proxy in `client/api/`).
- In Vercel Project Settings, set `BACKEND_BASE_URL=https://<cloud-run-url>` and `BACKEND_API_KEY=<backend API_KEY>` (server-only; the proxy adds `X-API-Key`).
- See `DEPLOY.md` for the full setup.

### 3.3 With Docker Compose
- Run from repo root: `docker compose up --build`
- Frontend served on `http://localhost:3000`
- Backend served on `http://localhost:8000`

### 3.4 Backend Deployment (Cloud Run)
- Cloud Build triggers deploy automatically when `server/**` changes: `dev` → `lp-backend-staging`, `main` → `lp-backend-prod` (`server/cloudbuild.yaml`). See `DEPLOY.md` for env vars and rollback.
- The container serves FastAPI with:
    - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check endpoint:
    - `GET /health`

## 4 SEO & Discoverability

The client includes per-route SEO optimizations so search engines and AI crawlers can discover and cite the site:

- **Per-route `<head>` tags** — each page sets its own `<title>`, `<meta description>`, canonical URL, OpenGraph, and Twitter Card tags via a shared `Seo` component (`client/src/seo/Seo.jsx`). Uses React 19 native `<head>` hoisting (no extra library).
- **JSON-LD structured data** — Home page emits `WebSite`, `WebApplication`, and `Organization` schemas (with a `SearchAction`). About page emits `AboutPage`, `Person`, `Organization`, and `BreadcrumbList`.
- **Crawl files** — `robots.txt` (allows search + AI search bots, blocks training-only crawlers) and `llms.txt` are served from `client/public/`; `sitemap.xml` is generated into `dist/` at build time from the indexable prerendered routes.
- **Pre-rendered SEO** — `npm run build` runs a post-build script (`client/scripts/prerender-seo.mjs`) that writes static HTML with `<title>`, meta tags, JSON-LD and readable body content for `/`, `/about`, `/topics` and the 24 reviewed `/learn/*` pages, plus noindex shells for `/feedback`, `/learningpath` and `/share`, so bots that don't execute JS still see the critical signals. It also writes a noindex `404.html`, which Vercel serves with a 404 status for unknown URLs outside `/api` so they load the app's not-found page instead of Vercel's plain-text error.
- **noindex on generator** — `/learningpath?term=...` is marked `noindex,follow` to prevent infinite indexable URLs.
- **Site constants** — `SITE_URL`, `SITE_NAME`, etc. are centralized in `client/src/config/site.js` (reads `VITE_SITE_URL` with a prod fallback).

## 5 Resources
- [GPT model output comparison tool](https://gpttools.com/comparisontool)
- [OpenAI Best Practices for Prompt Engineering](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api)
- [OpenAI documentation - model details](https://beta.openai.com/docs/models)
- [OpenAI example prompts and use cases](https://beta.openai.com/examples)
- [OpenAI Production Best Practice](https://beta.openai.com/docs/guides/production-best-practices)
- FE Utilities
    - [WebGradient Templates](https://webgradients.com/)
    - [ShareGPT](https://sharegpt.com/) - Design reference
- Similar ideas
    - [Similar idea: Learn from anyone](https://twitter.com/mckaywrigley/status/1284110063498522624)
    - [Roadmap.sh - open source learning groadmap project](https://roadmap.sh/frontend)
    - [Learn Anything xyz](https://learn-anything.xyz/)
    - [Learney - closest example](https://maps.joindeltaacademy.com/)
    - [Map of Reddit](https://anvaka.github.io/map-of-reddit/) by [Anvaka (graph lover)](https://github.com/anvaka)
- Miscellaneous
    - [Github Copilot code assistant](https://docs.github.com/en/copilot/quickstart)
    - [Fine tuning the model (GPT-3) - Tutorial by Weights & Biases](https://www.youtube.com/watch?v=5MNqn_7ty8A&ab_channel=Weights%26Biases) (to watch)
