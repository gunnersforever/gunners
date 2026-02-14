# Makefile convenience targets for DB migrations and dev
DBURL ?= sqlite:///./gunners.db
HOST ?= 0.0.0.0
PORT ?= 8000
FRONTEND_PORT ?= 5173

.PHONY: db-upgrade db-downgrade db-revision db-head init-db ensure-db

db-upgrade:
	DATABASE_URL=$(DBURL) alembic upgrade heads

db-downgrade:
	DATABASE_URL=$(DBURL) alembic downgrade -1

# usage: make db-revision MESSAGE="add foo"
db-revision:
	@if [ -z "$(MESSAGE)" ]; then echo "Please set MESSAGE='some message'"; exit 1; fi
	DATABASE_URL=$(DBURL) alembic revision --autogenerate -m "$(MESSAGE)"

db-head:
	DATABASE_URL=$(DBURL) alembic current

init-db:
	DATABASE_URL=$(DBURL) python -m project.init_db

ensure-db:
	@echo "Ensuring DB schema exists..."
	@DATABASE_URL=$(DBURL) python -m project.init_db

# -----------------------------
# Development / startup targets
# -----------------------------
.PHONY: start-backend start-backend-prod start-frontend build-frontend build-backend preview-frontend dev dev-stop setup

start-backend:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	DATABASE_URL=$(DBURL) uvicorn project.api:app --reload --host $(HOST) --port $(PORT)

start-backend-prod:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	DATABASE_URL=$(DBURL) uvicorn project.api:app --host $(HOST) --port $(PORT)

start-frontend:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	cd frontend && npm install --legacy-peer-deps && npm run dev -- --host $(HOST) --port $(FRONTEND_PORT) < /dev/null

build-frontend:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	cd frontend && npm install --legacy-peer-deps && npm run build

build-backend:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	@echo "Backend build step not required (Python)."

preview-frontend:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	cd frontend && npm run preview -- --host $(HOST) --port $(FRONTEND_PORT)

dev:
	@echo "Starting backend (background) and frontend (foreground)..."
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	$(MAKE) db-upgrade; \
	DATABASE_URL=$(DBURL) nohup uvicorn project.api:app --reload --host $(HOST) --port $(PORT) > backend.log 2>&1 & \
	cd frontend && npm install --legacy-peer-deps && npm run dev -- --host $(HOST) --port $(FRONTEND_PORT) < /dev/null

dev-stop:
	-@echo "Stopping backend uvicorn (if running)..."
	-@pkill -f "uvicorn project.api:app" || true
	-@echo "Stopping frontend Vite dev server (if running)..."
	-@pkill -f "vite" || true
	-@pkill -f "npm run dev" || true
	-@rm -f backend.log

setup:
	@echo "Setting up python venv and installing dependencies..."
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	-@python -m venv .venv || true
	@.venv/bin/python -m pip install -r project/requirements.txt
	@$(MAKE) ensure-db
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install --legacy-peer-deps
