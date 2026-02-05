from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import csv
import io
import os
import logging
from .portfolio_manager import retrieve_portfolio, write_portfolio, buy_ticker, sell_ticker, check_file_is_csv, get_ticker_price

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Portfolio Management API", version="1.0")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB-backed users/sessions using SQLAlchemy models
from project.db import get_db
from sqlalchemy.orm import Session
from project import models
from passlib.context import CryptContext
import datetime
import uuid

# Prefer bcrypt if available; include pbkdf2_sha256 in schemes for compatibility
import os
TOKEN_EXPIRE_DAYS = int(os.environ.get('TOKEN_EXPIRE_DAYS', '7'))

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
    if st.expires_at and st.expires_at < datetime.datetime.utcnow():
        # expired
        db.delete(st)
        db.commit()
        raise HTTPException(status_code=401, detail='Token expired')
    user = db.query(models.User).filter(models.User.id == st.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user.username

from sqlalchemy.exc import OperationalError

@app.post('/register')
def register(data: dict, db: Session = Depends(get_db)):
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        raise HTTPException(status_code=400, detail='Username and password required')
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
    user = models.User(username=username, password_hash=hash_password(password), active_portfolio='default')
    db.add(user)
    db.commit()
    db.refresh(user)
    # create default portfolio
    p = models.Portfolio(name='default', user_id=user.id)
    db.add(p)
    db.commit()
    logging.info('Registered new user: %s', username)
    return {'message': 'User registered'}

@app.post('/login')
def login(data: dict, db: Session = Depends(get_db)):
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
    access_expires = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)  # short-lived access token
    refresh_expires = datetime.datetime.utcnow() + datetime.timedelta(days=TOKEN_EXPIRE_DAYS)  # long-lived refresh token
    st_access = models.SessionToken(token=access_token, user_id=user.id, token_type='access', expires_at=access_expires, created_at=datetime.datetime.utcnow())
    st_refresh = models.SessionToken(token=refresh_token, user_id=user.id, token_type='refresh', expires_at=refresh_expires, created_at=datetime.datetime.utcnow())
    db.add(st_access)
    db.add(st_refresh)
    db.commit()
    portfolios = [p.name for p in user.portfolios]
    logging.info('User logged in: %s', username)
    return {'access_token': access_token, 'access_expires_at': access_expires.isoformat(), 'refresh_token': refresh_token, 'refresh_expires_at': refresh_expires.isoformat(), 'portfolios': portfolios, 'active': user.active_portfolio or 'default'}


@app.post('/token/refresh')
def refresh_token(authorization: str = Header(None), db: Session = Depends(get_db)):
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
    if st.expires_at and st.expires_at < datetime.datetime.utcnow():
        db.delete(st)
        db.commit()
        raise HTTPException(status_code=401, detail='Refresh token expired')
    # create new access token and rotate refresh token
    new_access = uuid.uuid4().hex
    new_refresh = uuid.uuid4().hex
    access_expires = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    refresh_expires = datetime.datetime.utcnow() + datetime.timedelta(days=TOKEN_EXPIRE_DAYS)
    st_access = models.SessionToken(token=new_access, user_id=st.user_id, token_type='access', expires_at=access_expires, created_at=datetime.datetime.utcnow())
    st_refresh = models.SessionToken(token=new_refresh, user_id=st.user_id, token_type='refresh', expires_at=refresh_expires, created_at=datetime.datetime.utcnow())
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
    return {'username': username, 'portfolios': portfolios, 'active': user.active_portfolio or 'default'}

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
    try:
        sorted_port = sorted(rows, key=lambda r: __import__('pandas').to_datetime(r.get('lasttransactiondate')), reverse=True)
    except Exception:
        sorted_port = rows
    return {'portfolio': sorted_port, 'name': pname}


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
        new_rows, message = buy_ticker(rows, symbol, str(quantity))
        # replace holdings
        db.query(models.Holding).filter(models.Holding.portfolio_id == portfolio.id).delete()
        for r in new_rows:
            sym = r.get('ticker') or r.get('symbol') or ''
            h = models.Holding(portfolio_id=portfolio.id, symbol=sym, quantity=float(r.get('quantity') or 0), avgcost=float(r.get('avgcost') or 0) if r.get('avgcost') else None, curprice=float(r.get('curprice') or 0) if r.get('curprice') else None, lasttransactiondate=r.get('lasttransactiondate',''), raw=str(r))
            db.add(h)
        db.commit()
        # ensure response uses 'symbol' key (legacy clients/tests expect this)
        for r in new_rows:
            if 'symbol' not in r and 'ticker' in r:
                r['symbol'] = r['ticker']
        logging.info('Buy completed for %s: %s', username, message)
        return {"message": message, "portfolio": new_rows, 'name': pname}
    except Exception as e:
        logging.error("Buy error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_price")
def get_price(symbol: str):
    price = get_ticker_price(symbol)
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
        new_rows, message = sell_ticker(rows, symbol, str(quantity))
        db.query(models.Holding).filter(models.Holding.portfolio_id == portfolio.id).delete()
        for r in new_rows:
            sym = r.get('ticker') or r.get('symbol') or ''
            h = models.Holding(portfolio_id=portfolio.id, symbol=sym, quantity=float(r.get('quantity') or 0), avgcost=float(r.get('avgcost') or 0) if r.get('avgcost') else None, curprice=float(r.get('curprice') or 0) if r.get('curprice') else None, lasttransactiondate=r.get('lasttransactiondate',''), raw=str(r))
            db.add(h)
        db.commit()
        for r in new_rows:
            if 'symbol' not in r and 'ticker' in r:
                r['symbol'] = r['ticker']
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