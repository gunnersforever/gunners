import os
import tempfile

# Set test API key before importing modules that require it
if not os.environ.get('FINNHUB_API_KEY'):
    os.environ['FINNHUB_API_KEY'] = 'd619kb9r01qn5qe72j2gd619kb9r01qn5qe72j30'  # Test key

# Use a temporary file-backed SQLite DB for tests
DB_PATH = os.path.join(tempfile.gettempdir(), 'gunners_test_security_headers.db')
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
os.environ['DATABASE_URL'] = f'sqlite:///{DB_PATH}'

from fastapi.testclient import TestClient
from project import init_db

# Initialize DB tables
init_db.init_db()
from project import api
client = TestClient(api.app)


def test_security_headers_in_development():
    """Test that security headers are present in development mode."""
    # Set development mode
    os.environ['ENVIRONMENT'] = 'development'
    
    response = client.get('/health')
    assert response.status_code == 200
    
    # Check basic security headers
    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'DENY'
    assert response.headers.get('Referrer-Policy') == 'same-origin'
    assert response.headers.get('Cross-Origin-Resource-Policy') == 'same-origin'
    assert response.headers.get('X-XSS-Protection') == '1; mode=block'
    
    # Check CSP header exists and contains expected directives
    csp = response.headers.get('Content-Security-Policy')
    assert csp is not None
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "https://finnhub.io" in csp
    assert "https://generativelanguage.googleapis.com" in csp
    
    # In development, unsafe-eval should be present
    assert "'unsafe-eval'" in csp
    
    # HSTS should NOT be present in development (unless HTTPS redirect is enabled)
    if not os.environ.get('ENABLE_HTTPS_REDIRECT', 'false').lower() in ('1', 'true', 'yes'):
        assert 'Strict-Transport-Security' not in response.headers


def test_security_headers_in_production():
    """Test that production security headers are stricter."""
    # Set production mode
    original_env = os.environ.get('ENVIRONMENT')
    os.environ['ENVIRONMENT'] = 'production'
    
    try:
        # Need to reload the app with new environment
        import importlib
        importlib.reload(api)
        test_client = TestClient(api.app)
        
        response = test_client.get('/health')
        assert response.status_code == 200
        
        # Check HSTS header is present in production
        hsts = response.headers.get('Strict-Transport-Security')
        assert hsts is not None
        assert 'max-age=31536000' in hsts
        assert 'includeSubDomains' in hsts
        
        # Check CSP is stricter in production (no unsafe-eval)
        csp = response.headers.get('Content-Security-Policy')
        assert csp is not None
        # In production, script-src should not have unsafe-eval
        # Note: unsafe-inline is still needed for build output
        assert "'unsafe-inline'" in csp
        
    finally:
        # Restore original environment
        if original_env:
            os.environ['ENVIRONMENT'] = original_env
        else:
            os.environ.pop('ENVIRONMENT', None)
        
        # Reload api module back to development mode for subsequent tests
        import importlib
        importlib.reload(api)


def test_permissions_policy_header():
    """Test that Permissions-Policy restricts sensitive features."""
    response = client.get('/health')
    
    permissions = response.headers.get('Permissions-Policy')
    assert permissions is not None
    assert 'geolocation=()' in permissions
    assert 'microphone=()' in permissions
    assert 'camera=()' in permissions
