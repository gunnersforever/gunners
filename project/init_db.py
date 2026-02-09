"""Utility to create DB tables quickly for development (runs SQLAlchemy create_all).
In production use Alembic migrations instead.
"""
from .db import engine, Base
# Ensure models are imported so Base.metadata is populated.
from . import models  # noqa: F401

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == '__main__':
    init_db()
    print('Initialized DB tables')
