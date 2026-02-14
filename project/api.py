from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import csv
import io
import os
import logging
import re
import json
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from .portfolio_manager import retrieve_portfolio, write_portfolio, buy_ticker, sell_ticker, check_file_is_csv, get_ticker_price, get_ticker_name

logging.basicConfig(level=logging.INFO)

SENTRY_DSN = os.environ.get('SENTRY_DSN', '').strip()
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.environ.get('SENTRY_ENVIRONMENT', 'production'),
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.0')),
        integrations=[FastApiIntegration()],
        send_default_pii=False,
    )
    logging.info('Sentry initialized')

@asynccontextmanager
async def lifespan(app):
    backfill_ticker_metadata()
    yield

app = FastAPI(title="Portfolio Management API", version="1.0", lifespan=lifespan)

RATE_LIMIT_DEFAULT = os.environ.get('RATE_LIMIT_DEFAULT', '200/minute')
RATE_LIMIT_AUTH = os.environ.get('RATE_LIMIT_AUTH', '10/minute')
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT_DEFAULT])
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
ALLOWED_ORIGINS_LIST = ['*'] if ALLOWED_ORIGINS == '*' else [
    origin.strip() for origin in ALLOWED_ORIGINS.split(',') if origin.strip()
]

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS_LIST,  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ENABLE_HTTPS_REDIRECT = os.environ.get('ENABLE_HTTPS_REDIRECT', 'false').lower() in ('1', 'true', 'yes')
if ENABLE_HTTPS_REDIRECT:
    app.add_middleware(HTTPSRedirectMiddleware)

from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
        return response

app.add_middleware(SecurityHeadersMiddleware)

# DB-backed users/sessions using SQLAlchemy models
from project.db import get_db, SessionLocal
from sqlalchemy.orm import Session
from project import models
from passlib.context import CryptContext
import datetime
import uuid

# Prefer bcrypt if available; include pbkdf2_sha256 in schemes for compatibility
import os
TOKEN_EXPIRE_DAYS = int(os.environ.get('TOKEN_EXPIRE_DAYS', '7'))
PRICE_CACHE_TTL_SECONDS = int(os.environ.get('PRICE_CACHE_TTL_SECONDS', '600'))
TICKER_NAME_TTL_DAYS = int(os.environ.get('TICKER_NAME_TTL_DAYS', '30'))
TICKER_NAME_TTL_SECONDS = TICKER_NAME_TTL_DAYS * 86400
FINNHUB_SYMBOLS_EXCHANGE = os.environ.get('FINNHUB_SYMBOLS_EXCHANGE', 'US')
FINNHUB_SYMBOLS_CACHE_TTL_SECONDS = int(os.environ.get('FINNHUB_SYMBOLS_CACHE_TTL_SECONDS', '604800'))
ENABLE_TICKER_BACKFILL = os.environ.get('ENABLE_TICKER_BACKFILL', 'false').lower() in ('1', 'true', 'yes')


def utcnow():
    return datetime.datetime.now(datetime.UTC)


def ensure_utc(value):
    if not value:
        return value
    if value.tzinfo is None:
        return value.replace(tzinfo=datetime.UTC)
    return value

try:
    import bcrypt  # optional native backend
    # include pbkdf2_sha256 so older hashes are recognized
    pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")
    # quick self-test: hash and verify a short password to ensure bcrypt works in this env
    try:
        test_hash = pwd_context.hash("_pass_test_short_")
        if not pwd_context.verify("_pass_test_short_", test_hash):
            raise Exception('bcrypt verify failed')
        logging.info('Using bcrypt backend for password hashing')
    except Exception:
        pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
        logging.warning('bcrypt present but not usable; falling back to pbkdf2_sha256')
except Exception:
    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
    logging.warning('bcrypt not installed; using pbkdf2_sha256')


from fastapi import Header, Depends

COMMON_PASSWORDS = {
    'password', 'password123', '12345678', '123456789', 'qwerty123', 'letmein123',
}

def validate_password_strength(password: str) -> str:
    if len(password) < 12:
        return 'Password must be at least 12 characters'
    if password.lower() in COMMON_PASSWORDS:
        return 'Password is too common'
    if not re.search(r'[a-z]', password):
        return 'Password must include a lowercase letter'
    if not re.search(r'[A-Z]', password):
        return 'Password must include an uppercase letter'
    if not re.search(r'\d', password):
        return 'Password must include a number'
    return ''

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

def require_auth(authorization: str = Header(None), db: Session = Depends(get_db)) -> str:
    """Require an access token (short-lived)."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Authorization required')
    token = authorization.split(' ', 1)[1]
    st = db.query(models.SessionToken).filter(models.SessionToken.token == token, models.SessionToken.token_type == 'access').first()
    if not st:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    if st.expires_at and ensure_utc(st.expires_at) < utcnow():
        # expired
        db.delete(st)
        db.commit()
        raise HTTPException(status_code=401, detail='Token expired')
    user = db.query(models.User).filter(models.User.id == st.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user.username

def get_cached_price(symbol: str, db: Session, force_refresh: bool = False):
    symbol = (symbol or '').strip().upper()
    if not symbol:
        return None
    now = utcnow()
    try:
        cached = db.query(models.PriceCache).filter(models.PriceCache.symbol == symbol).first()
    except OperationalError:
        return get_ticker_price(symbol)
    if cached and cached.updated_at and not force_refresh:
        age_seconds = (now - ensure_utc(cached.updated_at)).total_seconds()
        if age_seconds <= PRICE_CACHE_TTL_SECONDS and cached.price is not None:
            return cached.price
    price = get_ticker_price(symbol)
    if price is None:
        if cached and cached.price is not None:
            return cached.price
        return None
    if cached:
        cached.price = price
        cached.updated_at = now
    else:
        cached = models.PriceCache(symbol=symbol, price=price, updated_at=now)
        db.add(cached)
    db.commit()
    return price

def get_cached_ticker_name(symbol: str, db: Session, force_refresh: bool = False):
    symbol = (symbol or '').strip().upper()
    if not symbol:
        return None
    now = utcnow()
    try:
        cached = db.query(models.TickerMetadata).filter(models.TickerMetadata.symbol == symbol).first()
    except OperationalError:
        return None
    if cached and cached.name and cached.updated_at and not force_refresh:
        age_seconds = (now - ensure_utc(cached.updated_at)).total_seconds()
        if age_seconds <= TICKER_NAME_TTL_SECONDS:
            return cached.name
    name = get_ticker_name(symbol, exchange=FINNHUB_SYMBOLS_EXCHANGE, cache_ttl_seconds=FINNHUB_SYMBOLS_CACHE_TTL_SECONDS)
    if not name:
        return cached.name if cached else None
    if cached:
        cached.name = name
        cached.updated_at = now
    else:
        cached = models.TickerMetadata(symbol=symbol, name=name, updated_at=now)
        db.add(cached)
    db.commit()
    return name

def attach_ticker_names(rows, db: Session, force_refresh: bool = False):
    if not isinstance(rows, list):
        return rows
    for row in rows:
        symbol = (row.get('symbol') or row.get('ticker') or '').strip().upper()
        if not symbol:
            continue
        name = get_cached_ticker_name(symbol, db, force_refresh=force_refresh)
        if name:
            row['ticker_name'] = name
    return rows


def backfill_ticker_metadata():
    if not ENABLE_TICKER_BACKFILL:
        return
    db = SessionLocal()
    try:
        symbols = [row[0] for row in db.query(models.Holding.symbol).distinct().all()]
        for symbol in symbols:
            symbol = (symbol or '').strip().upper()
            if not symbol:
                continue
            existing = (
                db.query(models.TickerMetadata)
                .filter(models.TickerMetadata.symbol == symbol, models.TickerMetadata.name.isnot(None))
                .first()
            )
            if existing:
                continue
            get_cached_ticker_name(symbol, db, force_refresh=True)
    finally:
        db.close()



from sqlalchemy.exc import OperationalError

def serialize_advisor_history(row):
    try:
        profile = json.loads(row.profile_json) if row.profile_json else {}
    except json.JSONDecodeError:
        profile = {}
    try:
        recs = json.loads(row.recommendations_json) if row.recommendations_json else []
    except json.JSONDecodeError:
        recs = []
    return {
        'id': str(row.id),
        'created_at': row.created_at.isoformat() if row.created_at else '',
        'profile': profile,
        'recommendations': recs,
    }

def get_recent_advisor_history(user_id: int, db: Session):
    rows = (
        db.query(models.AdvisorHistory)
        .filter(models.AdvisorHistory.user_id == user_id)
        .order_by(models.AdvisorHistory.created_at.desc())
        .limit(3)
        .all()
    )
    return [serialize_advisor_history(row) for row in rows]

@limiter.limit(RATE_LIMIT_AUTH)
@app.post('/register')
def register(data: dict, request: Request, db: Session = Depends(get_db)):
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        raise HTTPException(status_code=400, detail='Username and password required')
    password_error = validate_password_strength(password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)
    try:
        existing = db.query(models.User).filter(models.User.username == username).first()
    except OperationalError as e:
        logging.error('Database error during register: %s', e)
        raise HTTPException(status_code=503, detail='Database not initialized. Run `make init-db` or `alembic upgrade head`')
    if existing:
        # If the existing user has the same password, treat register as idempotent and reset user state (useful for tests/dev).
        if verify_password(password, existing.password_hash):
            logging.info('Register called for existing user with same password: %s; resetting portfolios', username)
            # delete portfolios and holdings by IDs
            portfolios = db.query(models.Portfolio).filter(models.Portfolio.user_id == existing.id).all()
            portfolio_ids = [p.id for p in portfolios]
            if portfolio_ids:
                db.query(models.Holding).filter(models.Holding.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                db.query(models.Portfolio).filter(models.Portfolio.id.in_(portfolio_ids)).delete(synchronize_session=False)
            db.commit()
            # create default portfolio
            p = models.Portfolio(name='default', user_id=existing.id)
            db.add(p)
            existing.active_portfolio = 'default'
            db.commit()
            return {'message': 'User already exists; reset state'}
        raise HTTPException(status_code=400, detail='Username already exists')
    user = models.User(username=username, password_hash=hash_password(password), active_portfolio='default', theme_mode='light')
    db.add(user)
    db.commit()
    db.refresh(user)
    # create default portfolio
    p = models.Portfolio(name='default', user_id=user.id)
    db.add(p)
    db.commit()
    logging.info('Registered new user: %s', username)
    return {'message': 'User registered'}

@limiter.limit(RATE_LIMIT_AUTH)
@app.post('/login')
def login(data: dict, request: Request, db: Session = Depends(get_db)):
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        raise HTTPException(status_code=400, detail='Username and password required')
    try:
        user = db.query(models.User).filter(models.User.username == username).first()
    except OperationalError as e:
        logging.error('Database error during login: %s', e)
        raise HTTPException(status_code=503, detail='Database not initialized. Run `make init-db` or `alembic upgrade head`')
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    # issue access and refresh tokens
    access_token = uuid.uuid4().hex
    refresh_token = uuid.uuid4().hex
    access_expires = utcnow() + datetime.timedelta(minutes=15)  # short-lived access token
    refresh_expires = utcnow() + datetime.timedelta(days=TOKEN_EXPIRE_DAYS)  # long-lived refresh token
    st_access = models.SessionToken(token=access_token, user_id=user.id, token_type='access', expires_at=access_expires, created_at=utcnow())
    st_refresh = models.SessionToken(token=refresh_token, user_id=user.id, token_type='refresh', expires_at=refresh_expires, created_at=utcnow())
    db.add(st_access)
    db.add(st_refresh)
    db.commit()
    portfolios = [p.name for p in user.portfolios]
    logging.info('User logged in: %s', username)
    return {
        'access_token': access_token,
        'access_expires_at': access_expires.isoformat(),
        'refresh_token': refresh_token,
        'refresh_expires_at': refresh_expires.isoformat(),
        'portfolios': portfolios,
        'active': user.active_portfolio or 'default',
        'theme_mode': user.theme_mode or 'light',
    }

@app.get('/health')
def health():
    return {
        'status': 'ok',
        'version': app.version,
    }


@limiter.limit(RATE_LIMIT_AUTH)
@app.post('/token/refresh')
def refresh_token(request: Request, authorization: str = Header(None), db: Session = Depends(get_db)):
    """Accept a refresh token in Authorization header and issue a new access token.
    We rotate the refresh token as well (delete old refresh token and create a new one).
    Return both `access_token` and `refresh_token` (rotated) with expiries.
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Authorization required')
    token = authorization.split(' ', 1)[1]
    st = db.query(models.SessionToken).filter(models.SessionToken.token == token, models.SessionToken.token_type == 'refresh').first()
    if not st:
        raise HTTPException(status_code=401, detail='Invalid or expired refresh token')
    if st.expires_at and ensure_utc(st.expires_at) < utcnow():
        db.delete(st)
        db.commit()
        raise HTTPException(status_code=401, detail='Refresh token expired')
    # create new access token and rotate refresh token
    new_access = uuid.uuid4().hex
    new_refresh = uuid.uuid4().hex
    access_expires = utcnow() + datetime.timedelta(minutes=15)
    refresh_expires = utcnow() + datetime.timedelta(days=TOKEN_EXPIRE_DAYS)
    st_access = models.SessionToken(token=new_access, user_id=st.user_id, token_type='access', expires_at=access_expires, created_at=utcnow())
    st_refresh = models.SessionToken(token=new_refresh, user_id=st.user_id, token_type='refresh', expires_at=refresh_expires, created_at=utcnow())
    db.add(st_access)
    db.add(st_refresh)
    db.delete(st)
    db.commit()
    logging.info('Rotated refresh token for user_id %s', st.user_id)
    return {'access_token': new_access, 'access_expires_at': access_expires.isoformat(), 'refresh_token': new_refresh, 'refresh_expires_at': refresh_expires.isoformat()}


@app.post('/logout')
def logout(username: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    # delete all session tokens
    db.query(models.SessionToken).filter(models.SessionToken.user_id == user.id).delete()
    db.commit()
    logging.info('User logged out: %s', username)
    return {'message': 'Logged out'}

@app.get('/user/me')
def me(username: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    portfolios = [p.name for p in user.portfolios]
    return {
        'username': username,
        'portfolios': portfolios,
        'active': user.active_portfolio or 'default',
        'theme_mode': user.theme_mode or 'light',
    }

@app.get('/user/preferences')
def get_preferences(username: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return {'theme_mode': user.theme_mode or 'light'}

@app.post('/user/preferences')
def set_preferences(data: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    theme_mode = (data.get('theme_mode') or '').lower().strip()
    if theme_mode not in {'light', 'dark'}:
        raise HTTPException(status_code=400, detail='theme_mode must be light or dark')
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    user.theme_mode = theme_mode
    db.commit()
    return {'theme_mode': theme_mode}

@app.get('/advisor/history')
def advisor_history(username: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return {'history': get_recent_advisor_history(user.id, db)}

@app.post('/portfolio/create')
def create_portfolio(data: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    name = data.get('name')
    if not name:
        raise HTTPException(status_code=400, detail='Portfolio name required')
    user = db.query(models.User).filter(models.User.username == username).first()
    if any(p.name == name for p in user.portfolios):
        # idempotent: if portfolio exists, select it
        user.active_portfolio = name
        db.commit()
        logging.info('Portfolio already exists, selected %s for user %s', name, username)
        return {'message': 'Portfolio already exists', 'active': name}
    p = models.Portfolio(name=name, user_id=user.id)
    db.add(p)
    user.active_portfolio = name
    db.commit()
    logging.info('Created portfolio %s for user %s', name, username)
    return {'message': 'Portfolio created', 'active': name}

@app.post('/portfolio/select')
def select_portfolio(data: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    name = data.get('name')
    user = db.query(models.User).filter(models.User.username == username).first()
    if not any(p.name == name for p in user.portfolios):
        raise HTTPException(status_code=404, detail='Portfolio not found')
    user.active_portfolio = name
    db.commit()
    return {'message': 'Selected', 'active': name}

@app.get('/portfolio')
def get_portfolio(name: str = None, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    pname = name or user.active_portfolio or 'default'
    portfolio = next((p for p in user.portfolios if p.name == pname), None)
    if portfolio is None:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    # convert holdings to list of dicts
    rows = []
    for h in portfolio.holdings:
        rows.append({
            'symbol': h.symbol,
            'quantity': str(h.quantity),
            'avgcost': str(h.avgcost) if h.avgcost is not None else '',
            'curprice': str(h.curprice) if h.curprice is not None else '',
            'lasttransactiondate': h.lasttransactiondate or '',
        })
    attach_ticker_names(rows, db)
    try:
        sorted_port = sorted(rows, key=lambda r: __import__('pandas').to_datetime(r.get('lasttransactiondate')), reverse=True)
    except Exception:
        sorted_port = rows
    return {'portfolio': sorted_port, 'name': pname}


@app.post('/portfolio/reset')
def reset_portfolio(username: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    pname = user.active_portfolio or 'default'
    portfolio = next((p for p in user.portfolios if p.name == pname), None)
    if portfolio is None:
        portfolio = models.Portfolio(name=pname, user_id=user.id)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    db.query(models.Holding).filter(models.Holding.portfolio_id == portfolio.id).delete()
    db.commit()
    logging.info('Reset portfolio %s for user %s', pname, username)
    return {'message': 'Started new portfolio', 'portfolio': [], 'name': pname}


@app.post("/portfolio/load")
def load_portfolio(file: UploadFile = File(...), name: str = None, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    logging.info("Load request: %s for user %s", file.filename, username)
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    try:
        content = file.file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        rows = []
        for row in reader:
            rows.append(row)
        pname = name or db.query(models.User).filter(models.User.username == username).first().active_portfolio or 'default'
        user = db.query(models.User).filter(models.User.username == username).first()
        portfolio = next((p for p in user.portfolios if p.name == pname), None)
        if portfolio is None:
            portfolio = models.Portfolio(name=pname, user_id=user.id)
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)
        # delete existing holdings
        db.query(models.Holding).filter(models.Holding.portfolio_id == portfolio.id).delete()
        for row in rows:
            h = models.Holding(portfolio_id=portfolio.id, symbol=row.get('symbol',''), quantity=float(row.get('quantity',0) or 0), avgcost=float(row.get('avgcost') or 0) if row.get('avgcost') else None, curprice=float(row.get('curprice') or 0) if row.get('curprice') else None, lasttransactiondate=row.get('lasttransactiondate',''), raw=str(row))
            db.add(h)
        user.active_portfolio = pname
        db.commit()
        attach_ticker_names(rows, db)
        logging.info("Loaded %d rows into %s for user %s", len(rows), pname, username)
        return {"message": "Portfolio loaded successfully!", "portfolio": rows, "name": pname}
    except Exception as e:
        logging.error("Load error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/portfolio/save")
def save_portfolio(data: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    logging.info("Save request: %s for %s", data, username)
    filename = data.get("filename")
    pname = data.get('portfolio') or db.query(models.User).filter(models.User.username == username).first().active_portfolio or 'default'
    if not filename:
        raise HTTPException(status_code=400, detail="Filename required")
    user = db.query(models.User).filter(models.User.username == username).first()
    portfolio = next((p for p in user.portfolios if p.name == pname), None)
    if portfolio is None:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    rows = []
    for h in portfolio.holdings:
        rows.append({'symbol': h.symbol, 'quantity': str(h.quantity), 'avgcost': str(h.avgcost) if h.avgcost is not None else '', 'curprice': str(h.curprice) if h.curprice is not None else '', 'lasttransactiondate': h.lasttransactiondate or ''})
    # save file under username prefix to avoid collisions
    safe_filename = f"{username}_{filename}"
    full_path = os.path.join(os.path.dirname(__file__), safe_filename)
    logging.info("Saving to: %s", full_path)
    try:
        logging.info("Saving portfolio %s with %d records for user %s", pname, len(rows), username)
        message = write_portfolio(rows, full_path)
        logging.info("Save result: %s", message)
        return {"message": message, "saved_count": len(rows), 'saved_filename': safe_filename}
    except Exception as e:
        logging.error("Save error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
@app.post("/buy")
def buy(data: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    logging.info("Buy request: %s for user %s", data, username)
    symbol = data.get("symbol")
    quantity = data.get("quantity")
    if not symbol or not quantity:
        raise HTTPException(status_code=400, detail="Symbol and quantity required")
    try:
        user = db.query(models.User).filter(models.User.username == username).first()
        pname = data.get('portfolio') or user.active_portfolio or 'default'
        portfolio = next((p for p in user.portfolios if p.name == pname), None)
        if portfolio is None:
            raise HTTPException(status_code=404, detail='Portfolio not found')
        # convert holdings to list
        rows = []
        for h in portfolio.holdings:
            # use internal key 'ticker' for portfolio_manager
            rows.append({'ticker': h.symbol, 'quantity': str(h.quantity), 'avgcost': str(h.avgcost) if h.avgcost is not None else '', 'curprice': str(h.curprice) if h.curprice is not None else '', 'lasttransactiondate': h.lasttransactiondate or ''})
        cached_price = get_cached_price(symbol, db, force_refresh=True)
        if cached_price is None:
            raise HTTPException(status_code=400, detail=f"Unable to fetch price for {symbol}")
        new_rows, message = buy_ticker(rows, symbol, str(quantity), price=cached_price)
        # replace holdings
        db.query(models.Holding).filter(models.Holding.portfolio_id == portfolio.id).delete()
        for r in new_rows:
            sym = r.get('ticker') or r.get('symbol') or ''
            qty_val = float(r.get('quantity') or 0)
            totalcost_val = r.get('totalcost')
            avgcost_val = r.get('avgcost')
            if (avgcost_val is None or avgcost_val == '') and qty_val:
                if totalcost_val not in (None, ''):
                    avgcost_val = float(totalcost_val) / qty_val
            r['avgcost'] = avgcost_val if avgcost_val is not None else r.get('avgcost', '')
            h = models.Holding(
                portfolio_id=portfolio.id,
                symbol=sym,
                quantity=qty_val,
                avgcost=float(avgcost_val) if avgcost_val not in (None, '') else None,
                curprice=float(r.get('curprice') or 0) if r.get('curprice') else None,
                lasttransactiondate=r.get('lasttransactiondate',''),
                raw=str(r),
            )
            db.add(h)
        db.commit()
        # ensure response uses 'symbol' key (legacy clients/tests expect this)
        for r in new_rows:
            if 'symbol' not in r and 'ticker' in r:
                r['symbol'] = r['ticker']
        attach_ticker_names(new_rows, db, force_refresh=True)
        logging.info('Buy completed for %s: %s', username, message)
        return {"message": message, "portfolio": new_rows, 'name': pname}
    except Exception as e:
        logging.error("Buy error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_price")
def get_price(symbol: str, db: Session = Depends(get_db)):
    price = get_cached_price(symbol, db)
    logging.info("Get price for %s: %s", symbol, price)
    if price is None:
        raise HTTPException(status_code=400, detail="Unable to fetch price")
    return {"price": price}

@app.post("/sell")
def sell(data: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    logging.info("Sell request: %s for user %s", data, username)
    symbol = data.get("symbol")
    quantity = data.get("quantity")
    if not symbol or not quantity:
        raise HTTPException(status_code=400, detail="Symbol and quantity required")
    try:
        user = db.query(models.User).filter(models.User.username == username).first()
        pname = data.get('portfolio') or user.active_portfolio or 'default'
        portfolio = next((p for p in user.portfolios if p.name == pname), None)
        if portfolio is None:
            raise HTTPException(status_code=404, detail='Portfolio not found')
        rows = []
        for h in portfolio.holdings:
            rows.append({'ticker': h.symbol, 'quantity': str(h.quantity), 'avgcost': str(h.avgcost) if h.avgcost is not None else '', 'curprice': str(h.curprice) if h.curprice is not None else '', 'lasttransactiondate': h.lasttransactiondate or ''})
        cached_price = get_cached_price(symbol, db, force_refresh=True)
        if cached_price is None:
            raise HTTPException(status_code=400, detail=f"Unable to fetch price for {symbol}")
        new_rows, message = sell_ticker(rows, symbol, str(quantity), price=cached_price)
        db.query(models.Holding).filter(models.Holding.portfolio_id == portfolio.id).delete()
        for r in new_rows:
            sym = r.get('ticker') or r.get('symbol') or ''
            qty_val = float(r.get('quantity') or 0)
            totalcost_val = r.get('totalcost')
            avgcost_val = r.get('avgcost')
            if (avgcost_val is None or avgcost_val == '') and qty_val:
                if totalcost_val not in (None, ''):
                    avgcost_val = float(totalcost_val) / qty_val
            r['avgcost'] = avgcost_val if avgcost_val is not None else r.get('avgcost', '')
            h = models.Holding(
                portfolio_id=portfolio.id,
                symbol=sym,
                quantity=qty_val,
                avgcost=float(avgcost_val) if avgcost_val not in (None, '') else None,
                curprice=float(r.get('curprice') or 0) if r.get('curprice') else None,
                lasttransactiondate=r.get('lasttransactiondate',''),
                raw=str(r),
            )
            db.add(h)
        db.commit()
        for r in new_rows:
            if 'symbol' not in r and 'ticker' in r:
                r['symbol'] = r['ticker']
        attach_ticker_names(new_rows, db, force_refresh=True)
        logging.info('Sell completed for %s: %s', username, message)
        return {"message": message, "portfolio": new_rows, 'name': pname}
    except Exception as e:
        logging.error("Sell error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/portfolio/file/{filename}")
def get_portfolio_file(filename: str):
    # Basic validation to avoid directory traversal
    if '..' in filename or '/' in filename or '\\' in filename or not filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid filename")
    full_path = os.path.join(os.path.dirname(__file__), filename)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path, media_type='text/csv', filename=filename)


@app.post("/gemini/advise")
def gemini_advise(request: dict, username: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Call Gemini API for investment advisor recommendations."""
    try:
        prompt = request.get('prompt')
        profile = request.get('profile') or {}
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        # Get Gemini API key from environment
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel('models/gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            raise HTTPException(status_code=500, detail="No response from Gemini API")
        
        # Parse the response as JSON
        response_text = response.text
        
        # Try to extract JSON from the response
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            # If no JSON found, return the raw text
            return {
                "recommendations": [],
                "raw_response": response_text
            }
        
        json_str = response_text[json_start:json_end]
        data = json.loads(json_str)
        recs = data.get('recommendations') if isinstance(data, dict) else None
        if isinstance(recs, list):
            for rec in recs:
                if isinstance(rec, dict) and 'symbol' not in rec and 'ticker' in rec:
                    rec['symbol'] = rec.get('ticker')

        user = db.query(models.User).filter(models.User.username == username).first()
        if user:
            history = models.AdvisorHistory(
                user_id=user.id,
                created_at=utcnow(),
                profile_json=json.dumps(profile or {}),
                recommendations_json=json.dumps(data.get('recommendations') or []),
            )
            db.add(history)
            db.commit()
            # Keep only the 3 most recent rows
            rows = (
                db.query(models.AdvisorHistory)
                .filter(models.AdvisorHistory.user_id == user.id)
                .order_by(models.AdvisorHistory.created_at.desc())
                .all()
            )
            if len(rows) > 3:
                for old_row in rows[3:]:
                    db.delete(old_row)
                db.commit()
        data['history'] = get_recent_advisor_history(user.id, db) if user else []
        return data
    except json.JSONDecodeError as e:
        logging.error("JSON parse error: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to parse Gemini response: {str(e)}")
    except ImportError:
        logging.error("google-generativeai not installed")
        raise HTTPException(status_code=500, detail="Gemini API library not installed. Run: pip install google-generativeai")
    except Exception as e:
        logging.error("Gemini API error: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")