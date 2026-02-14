import os
import tempfile
import json
import pytest

# Use a temporary file-backed SQLite DB for tests to avoid SQLite in-memory
# connection isolation across threads used by TestClient.
DB_PATH = os.path.join(tempfile.gettempdir(), 'gunners_test_persistence.db')
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
os.environ['DATABASE_URL'] = f'sqlite:///{DB_PATH}'

from fastapi.testclient import TestClient
from project import init_db

# Initialize DB tables before importing `api` to ensure the in-memory DB has the
# correct schema the application will use.
init_db.init_db()
from project import api
client = TestClient(api.app)

USERNAME = 'testuser'
PASSWORD = 'testpass'

def auth_headers(token):
    return {'Authorization': f'Bearer {token}'}

def test_register_login_create_buy_save_download(tmp_path):
    # register
    r = client.post('/register', json={'username': USERNAME, 'password': PASSWORD})
    assert r.status_code == 200

    # login
    r = client.post('/login', json={'username': USERNAME, 'password': PASSWORD})
    assert r.status_code == 200
    access = r.json().get('access_token')
    assert access

    # create portfolio
    r = client.post('/portfolio/create', json={'name': 'Test1'}, headers=auth_headers(access))
    assert r.status_code == 200

    # buy AAPL
    r = client.post('/buy', json={'symbol': 'AAPL', 'quantity': 1, 'portfolio': 'Test1'}, headers=auth_headers(access))
    assert r.status_code == 200
    data = r.json()
    assert 'AAPL' in [h['symbol'] for h in data['portfolio']]

    # save portfolio
    fname = 'out_test.csv'
    r = client.post('/portfolio/save', json={'filename': fname, 'portfolio': 'Test1'}, headers=auth_headers(access))
    assert r.status_code == 200
    saved = r.json()
    assert saved.get('saved_count') == 1
    saved_filename = saved.get('saved_filename')
    assert saved_filename and saved_filename.endswith(fname)

    # download file
    r = client.get(f"/portfolio/file/{saved_filename}")
    assert r.status_code == 200
    text = r.text
    assert 'AAPL' in text
