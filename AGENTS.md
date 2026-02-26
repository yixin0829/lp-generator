# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

- **Backend** (`server/`): FastAPI on port 8000. See `CLAUDE.md` for all dev commands.
- **Frontend** (`client/`): Vite React SPA on port 3000. See `CLAUDE.md` for all dev commands.

### Running the dev servers

```bash
# Backend (from server/)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (from client/)
npm run dev
```

The frontend `.env.development` is preconfigured to call the backend at `http://localhost:8000`.

### Gotchas

- `uv` must be on `$PATH`. It installs to `~/.local/bin`; source `$HOME/.local/bin/env` if not found.
- Backend dev extras are under `[project.optional-dependencies]`, not `[dependency-groups]`. Use `uv sync --extra dev` (not `--group dev`).
- `server/.env` must exist for the backend to start. Copy from `server/.env.example` and set `OPENAI_API_KEY`. The key is required at runtime for learning-path generation but tests auto-fill it.
- `make lint` in `server/` has a pre-existing ruff F541 warning in `app/main.py` (f-string without placeholders).
- No frontend test files exist yet; `npm run test` exits with code 1 ("No test files found"). This is expected.
- Firestore backends (`COUNTER_BACKEND`, `CACHE_BACKEND`, `FEEDBACK_BACKEND`) all default to `noop`, so the app runs fully without any GCP credentials.
