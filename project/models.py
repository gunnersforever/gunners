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
