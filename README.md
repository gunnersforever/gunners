## Overview ✨
Simple portfolio management backend (FastAPI) + frontend (Vite/React). Includes database-backed user accounts, access/refresh token authentication, and Alembic migrations for schema changes.

---

## Quickstart — Backend (local development) 🚀
1. Create and activate a Python virtual environment:

```bash
python -m venv .venv
. .venv/bin/activate
```

2. Install Python dependencies:

```bash
pip install -r project/requirements.txt
```

3. Configure API keys (Tyche AI Advisor + Finnhub):
- Copy the env example and set the API keys:

```bash
cp .env.example .env
# edit .env and set GEMINI_API_KEY and FINNHUB_API_KEY
```

- For one-off runs, you can export directly:

```bash
export GEMINI_API_KEY='your_key_here'
export FINNHUB_API_KEY='your_finnhub_key_here'
```

4. Configure the database (optional):
- By default the app uses SQLite file `./gunners.db`.
- To override, set `DATABASE_URL` before running or testing, e.g.:

```bash
export DATABASE_URL='sqlite:///./dev.db'
```

5. Initialize database schema:
- For development, you can quickly create tables using:

```bash
python -m project.init_db
# or using the Makefile convenience:
make init-db
```

- If you'd like the setup process to ensure the DB is initialized automatically, `make setup` now runs a short `ensure-db` step which will initialize the DB schema if missing. You can also run the check/init yourself with:

```bash
# idempotent: will create tables if they are missing
make ensure-db
```

- For production or to apply versioned schema changes, run Alembic migrations:

```bash
# create a revision after modifying models (edit message as needed)
make db-revision MESSAGE="add some change"
# apply migrations
make db-upgrade
```

6. Run the API server:

```bash
uvicorn project.api:app --reload --host 0.0.0.0 --port 8000
```

> Note: Ensure `DATABASE_URL` is set before starting the server if you are not using the default file DB.

---

## Quickstart — Frontend (local development) 🧭
1. Enter the frontend folder and install packages:

```bash
cd frontend
npm install
```

2. Run the dev server:

```bash
npm run dev
```

The Vite dev server proxies `/api` to the backend. Make sure the backend is running (default: `http://localhost:8000`).

Note: The Tyche AI Advisor requires `GEMINI_API_KEY`, and market price + ticker-name lookups require `FINNHUB_API_KEY` to be configured in `.env` or exported in your shell before running the backend.

### Tyche AI Advisor history
The backend stores the 3 most recent advisor runs per user (inputs + recommendations). The UI exposes these via the Advisor drawer for quick comparison.

### Ticker name cache
The backend caches ticker symbols to names in a shared DB table (global across users) and reuses them for hover tooltips. Missing names are fetched from Finnhub on load/buy/sell, and an optional startup backfill can populate any missing symbols.

Simplified start (Makefile) ✅
For convenience, there are `Makefile` targets to setup and start the app during development.

- Setup python venv and install dependencies:
```bash
make setup
```

- Start both backend and frontend (backend runs in background; frontend runs in foreground):
```bash
make dev
```

- Stop the background backend:
```bash
make dev-stop
```

- Run individually:
```bash
make start-backend
make start-frontend
make build-backend
make build-frontend
```

This provides a one-line way to start the full stack.

---

## Production run (basic) 🧱
Use the Makefile targets below to run without auto-reload and with explicit host/port settings.

1. Ensure DB schema exists and migrations are applied:

```bash
make ensure-db
make db-upgrade
```

2. Start backend (no reload):

```bash
make start-backend-prod
```

3. Build and serve frontend (for a quick prod smoke test):

```bash
make build-frontend
make preview-frontend
```

Notes:
- Override ports/host as needed: `HOST=0.0.0.0 PORT=8000 FRONTEND_PORT=5173 make start-backend-prod`.
- `preview-frontend` uses Vite preview for a quick check; for real production, serve `frontend/dist` with a static web server.
- The frontend expects the backend at the same origin under `/api` in production. Configure your reverse proxy to route `/api` to the backend.

Example Nginx snippet:
```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8000/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Tests ✅
Run the test suite:

```bash
pytest -q
```

Notes:
- Tests use temporary SQLite DB files in the system temp directory to avoid in-memory connection isolation across threads.
### Troubleshooting ⚠️
- Python version: `make setup` now checks for **Python 3.10+** and will fail with a clear message if your `python` is older. If you see that message, install a newer Python and ensure `python` on your PATH points to the new version (or run `python3.10 -m venv .venv` manually before re-running `make setup`).

- pip notice: during `make setup` you may see a message that a newer `pip` is available. The Makefile now upgrades `pip`, `setuptools`, and `wheel` in the virtualenv automatically.

- Frontend npm peer dependency failures: some npm packages require specific peer versions of React. The Makefile uses `npm install --legacy-peer-deps` to avoid interactive peer-dep resolution failures during `make setup`/`make dev`. If you prefer to resolve peer deps yourself, install frontend deps with `cd frontend && npm install`.
---

## Authentication & Tokens 🔒
- Login (`POST /login`) returns **access_token** and **refresh_token**.
- Use the access token for protected endpoints with the header:

```http
Authorization: Bearer <access_token>
```

- To rotate tokens, call `POST /token/refresh` with the refresh token in the same header form. Refresh tokens are long-lived; access tokens are short-lived.

---

## Migrations & Schema Changes 🧩
- Preferred flow for schema changes:
  1. Update SQLAlchemy models in `project/models.py`.
  2. Create a migration: `make db-revision MESSAGE="describe change"`.
  3. Apply it: `make db-upgrade` (or `alembic upgrade head`).

- For tests or quick local development you can use `python -m project.init_db` to create tables from models — but prefer Alembic in CI and production.

---

## Password hashing
- The server prefers the `bcrypt` backend (installed via `passlib[bcrypt]`). If `bcrypt` is not available, the code falls back to `pbkdf2_sha256` for compatibility.

---

## Troubleshooting & Tips 💡
- If you see `no such table` errors in tests, ensure tests initialize the DB schema before importing the app (tests call `project.init_db.init_db()` automatically).
- To reset the DB quickly during development: stop the server, remove `gunners.db`, and re-run `python -m project.init_db` or use migrations.

---

If you'd like, I can add a `conftest.py` to centralize test DB setup/teardown or convert tests to use per-test temporary DB files. 🔧
