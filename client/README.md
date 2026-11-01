# LearnAnything frontend

React 19 + Vite single-page app, deployed on Vercel (root directory `client`). The `api/` folder holds Vercel serverless functions that proxy browser requests to the Cloud Run backend and add the `X-API-Key` header server-side.

## Scripts

```bash
npm ci            # Install from the committed package-lock.json
npm run dev       # Dev server at http://localhost:3000 (calls the backend at VITE_API_BASE_URL)
npm run build     # Production build, SEO prerender (scripts/prerender-seo.mjs) and SEO verification
npm run preview   # Serve the production build locally
npm run test      # Unit tests (vitest)
npm run test:e2e  # Playwright browser tests with a mocked backend (first run: npx playwright install chromium)
```

## Environment

- `VITE_API_BASE_URL`: `http://localhost:8000` in `.env.development`; `/api` in `.env.production` (the Vercel proxy).
- `VITE_SITE_URL`: canonical origin for SEO tags (falls back to the production URL).
- `BACKEND_BASE_URL` / `BACKEND_API_KEY`: Vercel server-only, used by `api/`.

See the repository `README.md`, `CLAUDE.md` and `DEPLOY.md` for the full picture.
