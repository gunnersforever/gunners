import os
import tempfile

# Set test API key before importing modules that require it
if not os.environ.get('FINNHUB_API_KEY'):
    os.environ['FINNHUB_API_KEY'] = 'd619kb9r01qn5qe72j2gd619kb9r01qn5qe72j30'  # Test key

DB_PATH = os.path.join(tempfile.gettempdir(), 'gunners_test_token_refresh.db')
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
os.environ['DATABASE_URL'] = f'sqlite:///{DB_PATH}'
from fastapi.testclient import TestClient
from project import init_db

# Initialize DB tables before importing `api` to ensure the in-memory DB has the
# correct schema the application will use.
init_db.init_db()
from project import api
# Reload api module to ensure it uses the correct DATABASE_URL after other tests might have reloaded it
import importlib
importlib.reload(api)
client = TestClient(api.app)

USERNAME = 'tokenuser'
PASSWORD = 'TokenPass12345'


def get_csrf_token(response):
    """Extract CSRF token from login/refresh response."""
    data = response.json()
    return data.get('csrf_token', '')


def test_token_refresh_and_expiry():
    # register/login
    r = client.post('/register', json={'username': USERNAME, 'password': PASSWORD})
    assert r.status_code == 200
    r = client.post('/login', json={'username': USERNAME, 'password': PASSWORD})
    assert r.status_code == 200
    
    csrf_token = get_csrf_token(r)
    assert csrf_token  # CSRF token should be present
    # Cookies (access_token, refresh_token) are automatically stored in client

    # access token works (cookie sent automatically)
    r = client.get('/user/me')
    assert r.status_code == 200

    # expire access token artificially and ensure it is rejected
    from project.db import SessionLocal
    from project import models
    import datetime
    db = SessionLocal()
    
    # Get access token from cookies
    access_token = client.cookies.get('access_token')
    assert access_token
    
    st = db.query(models.SessionToken).filter(
        models.SessionToken.token == access_token, 
        models.SessionToken.token_type == 'access'
    ).first()
    assert st
    st.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=1)
    db.add(st)
    db.commit()

    r = client.get('/user/me')
    assert r.status_code == 401

    # Get refresh token from cookies before refreshing
    old_refresh_token = client.cookies.get('refresh_token')
    assert old_refresh_token

    # use refresh token to get new tokens (rotating refresh)
    # Cookies are sent automatically
    r = client.post('/token/refresh')
    assert r.status_code == 200
    new_csrf_token = get_csrf_token(r)
    assert new_csrf_token
    # New cookies are automatically updated in client
    
    new_access_token = client.cookies.get('access_token')
    new_refresh_token = client.cookies.get('refresh_token')
    assert new_access_token and new_refresh_token and new_refresh_token != old_refresh_token

    # old refresh should be invalid (simulate by manually setting old cookie)
    # Create a new client with old refresh token
    from fastapi.testclient import TestClient
    test_client_2 = TestClient(api.app)
    test_client_2.cookies.set('refresh_token', old_refresh_token)
    r = test_client_2.post('/token/refresh')
    assert r.status_code == 401

    # new access works
    r = client.get('/user/me')
    assert r.status_code == 200

    # expire refresh token artificially and ensure it is rejected
    st2 = db.query(models.SessionToken).filter(
        models.SessionToken.token == new_refresh_token, 
        models.SessionToken.token_type == 'refresh'
    ).first()
    st2.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1)
    db.add(st2)
    db.commit()
    r = client.post('/token/refresh')
    assert r.status_code == 401
