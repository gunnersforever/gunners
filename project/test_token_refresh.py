import os

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
from fastapi.testclient import TestClient
from project import init_db
from project import api

init_db.init_db()
client = TestClient(api.app)

USERNAME = 'tokenuser'
PASSWORD = 'tokenpass'


def auth_headers(token):
    return {'Authorization': f'Bearer {token}'}


def test_token_refresh_and_expiry():
    # register/login
    r = client.post('/register', json={'username': USERNAME, 'password': PASSWORD})
    assert r.status_code == 200
    r = client.post('/login', json={'username': USERNAME, 'password': PASSWORD})
    assert r.status_code == 200
    token = r.json().get('token')
    assert token

    # refresh token
    r = client.post('/token/refresh', headers=auth_headers(token))
    assert r.status_code == 200
    new_token = r.json().get('token')
    assert new_token and new_token != token

    # old token should now be invalid
    r = client.get('/user/me', headers=auth_headers(token))
    assert r.status_code == 401

    # new token should be valid
    r = client.get('/user/me', headers=auth_headers(new_token))
    assert r.status_code == 200

    # expire token artificially and ensure it is rejected
    # (direct DB manipulation)
    from project.db import SessionLocal
    from project import models
    db = SessionLocal()
    st = db.query(models.SessionToken).filter(models.SessionToken.token == new_token).first()
    assert st
    import datetime
    st.expires_at = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    db.add(st)
    db.commit()

    r = client.get('/user/me', headers=auth_headers(new_token))
    assert r.status_code == 401
