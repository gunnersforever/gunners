# gunners
GTG - Get Things Going

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

3. Configure the database (optional):
- By default the app uses SQLite file `./gunners.db`.
- To override, set `DATABASE_URL` before running or testing, e.g.:

```bash
export DATABASE_URL='sqlite:///./dev.db'
```

4. Initialize database schema:
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

5. Run the API server:

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
```

This provides a one-line way to start the full stack.

---

## Tests ✅
Run the test suite:

```bash
pytest -q
```

Notes:
- Tests use a temporary SQLite DB (`./test.db`) by default in this workspace to avoid in-memory connection isolation across threads. Remove it between test runs if you need a clean state.
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
