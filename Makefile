# Makefile convenience targets for DB migrations and dev
DBURL ?= sqlite:///./project/gunners.db

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
