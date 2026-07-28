from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional

import yfinance as yf

from app.core.config import Settings, get_settings


# Simple cache for stock prices with 60-second TTL
_price_cache: Dict[str, tuple[float, float]] = {}  # symbol -> (price, timestamp)
_price_cache_lock = Lock()


def _get_price_from_yfinance(symbol: str) -> float:
    """Fetch current price from yfinance."""
    ticker = yf.Ticker(symbol)
    # Try to get the latest price from fast_info or history
    try:
        # fast_info is available in newer yfinance versions
        price = ticker.fast_info.last_price
        if price is None or price <= 0:
            # Fallback to history
            hist = ticker.history(period="1d")
            if not hist.empty:
                price = hist["Close"].iloc[-1]
            else:
                raise ValueError(f"No price data for {symbol}")
    except Exception:
        # Fallback to info
        info = ticker.info
        price = info.get("regularMarketPrice") or info.get("previousClose") or 0.0
    return float(price)


def get_price(symbol: str) -> float:
    """Get current price for symbol with 60-second caching."""
    now = time.time()
    with _price_cache_lock:
        cached = _price_cache.get(symbol)
        if cached:
            price, timestamp = cached
            if now - timestamp < 60:  # 60 seconds TTL
                return price
    # Fetch fresh price
    price = _get_price_from_yfinance(symbol)
    with _price_cache_lock:
        _price_cache[symbol] = (price, now)
    return price


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
STORE_PATH = DATA_DIR / "portfolios.json"


@dataclass
class Position:
    symbol: str
    qty: float
    avg_cost: float
    created_at: str


@dataclass
class Trade:
    id: str
    portfolio: str
    symbol: str
    side: str  # "BUY" | "SELL"
    qty: float
    price: float
    timestamp: str
    reason: str = ""  # "manual" | "ai:verdict"


@dataclass
class Portfolio:
    name: str
    mode: str  # "manual" | "ai"
    cash: float
    positions: Dict[str, Position]
    created_at: str
    is_ultron: bool = False

    def __post_init__(self):
        if self.created_at == "":
            self.created_at = time.strftime("%Y-%m-%d %H:%M:%S")


class PortfolioService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._lock = Lock()
        self._portfolios: Dict[str, Portfolio] = {}
        self.load_store()
        self.ensure_ultron()

    def load_store(self) -> None:
        """Load portfolios from JSON file."""
        with self._lock:
            if not STORE_PATH.exists():
                self._portfolios = {}
                return
            try:
                with open(STORE_PATH, "r") as f:
                    data = json.load(f)
                self._portfolios = {}
                for name, p_dict in data.items():
                    # Convert positions dict of dicts to Position objects
                    positions = {}
                    for symbol, pos_dict in p_dict.get("positions", {}).items():
                        positions[symbol] = Position(**pos_dict)
                    p_dict["positions"] = positions
                    # Ensure is_ultron exists (for backward compatibility)
                    if "is_ultron" not in p_dict:
                        p_dict["is_ultron"] = False
                    self._portfolios[name] = Portfolio(**p_dict)
            except (json.JSONDecodeError, TypeError) as e:
                print(f"Error loading portfolios: {e}")
                self._portfolios = {}

    def save_store(self) -> None:
        """Save portfolios to JSON file."""
        with self._lock:
            data = {}
            for name, portfolio in self._portfolios.items():
                p_dict = asdict(portfolio)
                # Convert positions to dict of dicts for JSON serialization
                positions_dict = {}
                for symbol, pos in p_dict["positions"].items():
                    positions_dict[symbol] = asdict(pos)
                p_dict["positions"] = positions_dict
                data[name] = p_dict
            # Write atomically by writing to a temp file then renaming
            temp_path = STORE_PATH.with_suffix(".tmp")
            with open(temp_path, "w") as f:
                json.dump(data, f, indent=2)
            temp_path.replace(STORE_PATH)

    def ensure_ultron(self) -> None:
        """Ensure the Ultron portfolio exists on startup."""
        with self._lock:
            if "Ultron" not in self._portfolios:
                ultron = Portfolio(
                    name="Ultron",
                    mode="ai",
                    cash=100000.0,  # 100k cash as per requirement
                    positions={},
                    created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                    is_ultron=True,
                )
                self._portfolios["Ultron"] = ultron
                self.save_store()

    def list_portfolios(self) -> List[Portfolio]:
        """Return a list of all portfolios."""
        with self._lock:
            return list(self._portfolios.values())

    def get_portfolio(self, name: str) -> Optional[Portfolio]:
        """Get a portfolio by name."""
        with self._lock:
            return self._portfolios.get(name)

    def create_portfolio(self, name: str, initial_cash: float, mode: str = "manual") -> Portfolio:
        """Create a new portfolio."""
        with self._lock:
            if name in self._portfolios:
                raise ValueError(f"Portfolio '{name}' already exists")
            portfolio = Portfolio(
                name=name,
                mode=mode,
                cash=initial_cash,
                positions={},
                created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                is_ultron=False,
            )
            self._portfolios[name] = portfolio
            self.save_store()
            return portfolio

    def buy(self, name: str, symbol: str, qty: float, price: Optional[float] = None, reason: str = "manual") -> Trade:
        """Buy shares of a symbol."""
        with self._lock:
            portfolio = self._portfolios.get(name)
            if not portfolio:
                raise ValueError(f"Portfolio '{name}' not found")
            if portfolio.is_ultron and reason == "manual":
                # Ultron portfolio cannot be traded manually? The requirement says cannot be deleted, but trading?
                # We'll allow trading but note that the reason might be overridden by AI later.
                pass
            if qty <= 0:
                raise ValueError("Quantity must be positive")
            if price is None:
                price = get_price(symbol)
            if price <= 0:
                raise ValueError(f"Invalid price for {symbol}: {price}")
            cost = price * qty
            if cost > portfolio.cash:
                raise ValueError(f"Insufficient cash: need {cost}, have {portfolio.cash}")
            # Update cash
            portfolio.cash -= cost
            # Update position
            if symbol in portfolio.positions:
                pos = portfolio.positions[symbol]
                # Weighted average cost
                total_qty = pos.qty + qty
                total_cost = pos.avg_cost * pos.qty + cost
                pos.avg_cost = total_cost / total_qty if total_qty != 0 else 0
                pos.qty = total_qty
            else:
                portfolio.positions[symbol] = Position(
                    symbol=symbol,
                    qty=qty,
                    avg_cost=price,
                    created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )
            # Create trade record
            trade = Trade(
                id=str(uuid.uuid4()),
                portfolio=name,
                symbol=symbol,
                side="BUY",
                qty=qty,
                price=price,
                timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                reason=reason,
            )
            self.save_store()
            return trade

    def sell(self, name: str, symbol: str, qty: float, price: Optional[float] = None, reason: str = "manual") -> Trade:
        """Sell shares of a symbol."""
        with self._lock:
            portfolio = self._portfolios.get(name)
            if not portfolio:
                raise ValueError(f"Portfolio '{name}' not found")
            if portfolio.is_ultron and reason == "manual":
                # Similar to buy, we allow but note the reason
                pass
            if qty <= 0:
                raise ValueError("Quantity must be positive")
            if symbol not in portfolio.positions:
                raise ValueError(f"No position in {symbol} to sell")
            pos = portfolio.positions[symbol]
            if qty > pos.qty:
                raise ValueError(f"Insufficient position: have {pos.qty}, trying to sell {qty}")
            if price is None:
                price = get_price(symbol)
            if price <= 0:
                raise ValueError(f"Invalid price for {symbol}: {price}")
            proceeds = price * qty
            # Update cash
            portfolio.cash += proceeds
            # Update position
            pos.qty -= qty
            if pos.qty == 0:
                del portfolio.positions[symbol]
            # Note: avg_cost remains the same for the remaining shares (if any)
            # Create trade record
            trade = Trade(
                id=str(uuid.uuid4()),
                portfolio=name,
                symbol=symbol,
                side="SELL",
                qty=qty,
                price=price,
                timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                reason=reason,
            )
            self.save_store()
            return trade

    def value_portfolio(self, portfolio: Portfolio) -> dict:
        """Calculate the current value of a portfolio."""
        total = portfolio.cash
        positions_info = []
        for symbol, pos in portfolio.positions.items():
            price = get_price(symbol)
            value = pos.qty * price
            cost = pos.qty * pos.avg_cost
            pnl = value - cost
            pnl_pct = (pnl / cost * 100) if cost != 0 else 0.0
            total += value
            positions_info.append(
                {
                    "symbol": symbol,
                    "qty": pos.qty,
                    "avg_cost": pos.avg_cost,
                    "price": price,
                    "value": value,
                    "pnl": pnl,
                    "pnl_pct": pnl_pct,
                }
            )
        invested = sum(pos.qty * pos.avg_cost for pos in portfolio.positions.values())
        pnl_total = total - (portfolio.cash + invested)
        pnl_pct_total = (pnl_total / invested * 100) if invested != 0 else 0.0
        return {
            "total": total,
            "cash": portfolio.cash,
            "invested": invested,
            "pnl": pnl_total,
            "pnl_pct": pnl_pct_total,
            "positions": positions_info,
        }

    def portfolio_history(self, name: str) -> list[dict]:
        """Return snapshot history per trade.
        For simplicity, we'll return an empty list as we don't store history yet.
        The requirement says snapshot per trade, but we don't have a history log.
        We could implement by storing each trade and then computing the snapshot after each trade.
        However, for now, we return an empty list and note that this needs to be implemented.
        """
        # TODO: Implement history tracking by storing snapshots after each trade.
        # For now, return empty list.
        return []


# Singleton instance for use in the API
portfolio_service = PortfolioService()