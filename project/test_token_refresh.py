import os

os.environ['DATABASE_URL'] = 'sqlite:///./test.db'
from fastapi.testclient import TestClient
from project import init_db

# Initialize DB tables before importing `api` to ensure the in-memory DB has the
# correct schema the application will use.
init_db.init_db()
from project import api
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
    body = r.json()
    access = body.get('access_token')
    refresh = body.get('refresh_token')
    assert access and refresh

    # access token works
    r = client.get('/user/me', headers=auth_headers(access))
    assert r.status_code == 200

    # expire access token artificially and ensure it is rejected
    from project.db import SessionLocal
    from project import models
    import datetime
    db = SessionLocal()
    st = db.query(models.SessionToken).filter(models.SessionToken.token == access, models.SessionToken.token_type == 'access').first()
    assert st
    st.expires_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
    db.add(st)
    db.commit()

    r = client.get('/user/me', headers=auth_headers(access))
    assert r.status_code == 401

    # use refresh token to get new tokens (rotating refresh)
    r = client.post('/token/refresh', headers=auth_headers(refresh))
    assert r.status_code == 200
    body2 = r.json()
    new_access = body2.get('access_token')
    new_refresh = body2.get('refresh_token')
    assert new_access and new_refresh and new_refresh != refresh

    # old refresh should be invalid
    r = client.post('/token/refresh', headers=auth_headers(refresh))
    assert r.status_code == 401

    # new access works
    r = client.get('/user/me', headers=auth_headers(new_access))
    assert r.status_code == 200

    # expire refresh token artificially and ensure it is rejected
    st2 = db.query(models.SessionToken).filter(models.SessionToken.token == new_refresh, models.SessionToken.token_type == 'refresh').first()
    st2.expires_at = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    db.add(st2)
    db.commit()
    r = client.post('/token/refresh', headers=auth_headers(new_refresh))
    assert r.status_code == 401
