# Makefile convenience targets for DB migrations and dev
DBURL ?= sqlite:///./project/gunners.db

.PHONY: db-upgrade db-downgrade db-revision db-head init-db ensure-db

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
	DATABASE_URL=$(DBURL) python -m project.init_db

ensure-db:
	@echo "Ensuring DB schema exists..."
	@DATABASE_URL=$(DBURL) python -m project.init_db

# -----------------------------
# Development / startup targets
# -----------------------------
.PHONY: start-backend start-frontend dev dev-stop setup

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
	@echo "Setting up python venv and installing dependencies..."
	-@python -m venv .venv || true
	@.venv/bin/python -m pip install -r project/requirements.txt
	@$(MAKE) ensure-db
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install --legacy-peer-deps
