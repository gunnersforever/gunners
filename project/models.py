from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import relationship
from .db import Base
import datetime

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    active_portfolio = Column(String, nullable=True)
    theme_mode = Column(String, nullable=False, default='light')

    portfolios = relationship('Portfolio', back_populates='owner', cascade='all, delete-orphan')
    sessions = relationship('SessionToken', back_populates='user', cascade='all, delete-orphan')

class Portfolio(Base):
    __tablename__ = 'portfolios'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    owner = relationship('User', back_populates='portfolios')
    holdings = relationship('Holding', back_populates='portfolio', cascade='all, delete-orphan')

class Holding(Base):
    __tablename__ = 'holdings'
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.id'), nullable=False)
    symbol = Column(String, nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    avgcost = Column(Float, nullable=True)
    curprice = Column(Float, nullable=True)
    lasttransactiondate = Column(String, nullable=True)
    raw = Column(Text, nullable=True)

    portfolio = relationship('Portfolio', back_populates='holdings')

class SessionToken(Base):
    __tablename__ = 'session_tokens'
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token_type = Column(String, nullable=False, default='access')  # 'access' or 'refresh'
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=True)

    user = relationship('User', back_populates='sessions')

class PriceCache(Base):
    __tablename__ = 'price_cache'
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    price = Column(Float, nullable=True)
    updated_at = Column(DateTime, nullable=True)

class AdvisorHistory(Base):
    __tablename__ = 'advisor_history'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    profile_json = Column(Text, nullable=False, default='{}')
    recommendations_json = Column(Text, nullable=False, default='[]')

    user = relationship('User')
