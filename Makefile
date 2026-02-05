# Makefile convenience targets for DB migrations and dev
DBURL ?= sqlite:///./gunners.db

.PHONY: db-upgrade db-downgrade db-revision db-head init-db

db-upgrade:
	DATABASE_URL=$(DBURL) alembic upgrade head

db-downgrade:
	DATABASE_URL=$(DBURL) alembic downgrade -1

# usage: make db-revision MESSAGE="add foo"
db-revision:
	@if [ -z "$(MESSAGE)" ]; then echo "Please set MESSAGE='some message'"; exit 1; fi
	DATABASE_URL=$(DBURL) alembic revision --autogenerate -m "$(MESSAGE)"

db-head:
	DATABASE_URL=$(DBURL) alembic current

init-db:
	python -m project.init_db

ensure-db:
	@echo "Ensuring DB schema exists..."
	@DATABASE_URL=$(DBURL) python -c "import project.init_db as _; _.init_db(); print('Database initialized or already up to date')"

# -----------------------------
# Development / startup targets
# -----------------------------
.PHONY: start-backend start-frontend dev dev-stop setup ensure-db

start-backend:
	DATABASE_URL=$(DBURL) uvicorn project.api:app --reload --host 0.0.0.0 --port 8000

start-frontend:
	cd frontend && npm install --legacy-peer-deps && npm run dev

dev:
	@echo "Starting backend (background) and frontend (foreground)..."
	@DATABASE_URL=$(DBURL) nohup uvicorn project.api:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1 & \
	cd frontend && npm install --legacy-peer-deps && npm run dev

dev-stop:
	-@echo "Stopping backend uvicorn (if running)..."
	-@pkill -f "uvicorn project.api:app" || true
	-@rm -f backend.log

setup:
	@echo "Checking Python version (>= 3.10)..."
	@python -c "import sys; sys.exit(0) if sys.version_info >= (3,10) else sys.exit(1)" || (echo "Python 3.10+ is required. Please install a recent Python and retry."; exit 1)
	@echo "Setting up python venv and installing dependencies..."
	-@python -m venv .venv || true
	@.venv/bin/python -m pip install --upgrade pip setuptools wheel
	@.venv/bin/python -m pip install -r project/requirements.txt
	@echo "Ensuring database schema exists (init-db)..."
	@$(MAKE) ensure-db
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install --legacy-peer-deps
