from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import time

from app.services.portfolio_service import portfolio_service, Portfolio, Position, Trade

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


# Pydantic models for request/response
class PortfolioCreate(BaseModel):
    name: str
    initial_cash: float = Field(..., gt=0)
    mode: str = Field(default="manual", pattern="^(manual|ai)$")


class PortfolioResponse(BaseModel):
    name: str
    mode: str
    cash: float
    positions: Dict[str, Any]
    created_at: str
    is_ultron: bool


class TradeRequest(BaseModel):
    symbol: str
    qty: float = Field(..., gt=0)
    price: Optional[float] = Field(None, gt=0)


class TradeResponse(BaseModel):
    id: str
    portfolio: str
    symbol: str
    side: str
    qty: float
    price: float
    timestamp: str
    reason: str


class PortfolioValueResponse(BaseModel):
    total: float
    cash: float
    invested: float
    pnl: float
    pnl_pct: float
    positions: List[Dict[str, Any]]


class PerformanceResponse(BaseModel):
    history: List[Dict[str, Any]]
    total_return: float
    win_rate: float
    sharpe: Optional[float] = None


class DecisionResponse(BaseModel):
    action: str  # BUY, SELL, HOLD
    symbol: str
    qty: float
    confidence: float
    reason: str


class AutoTradeResponse(BaseModel):
    decision: DecisionResponse
    trade: Optional[TradeResponse] = None
    trace: Dict[str, Any]


# Helper function to convert Portfolio to response dict
def portfolio_to_dict(portfolio: Portfolio) -> dict:
    return {
        "name": portfolio.name,
        "mode": portfolio.mode,
        "cash": portfolio.cash,
        "positions": {symbol: {"symbol": pos.symbol, "qty": pos.qty, "avg_cost": pos.avg_cost, "created_at": pos.created_at}
                      for symbol, pos in portfolio.positions.items()},
        "created_at": portfolio.created_at,
        "is_ultron": portfolio.is_ultron,
    }


# Endpoints
@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(request: PortfolioCreate):
    """Create a new portfolio."""
    try:
        portfolio = portfolio_service.create_portfolio(
            name=request.name,
            initial_cash=request.initial_cash,
            mode=request.mode,
        )
        return portfolio_to_dict(portfolio)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[PortfolioResponse])
async def list_portfolios():
    """List all portfolios."""
    portfolios = portfolio_service.list_portfolios()
    return [portfolio_to_dict(p) for p in portfolios]


@router.get("/{name}", response_model=PortfolioResponse)
async def get_portfolio(name: str):
    """Get a specific portfolio."""
    portfolio = portfolio_service.get_portfolio(name)
    if not portfolio:
        raise HTTPException(status_code=404, detail=f"Portfolio '{name}' not found")
    return portfolio_to_dict(portfolio)


@router.post("/{name}/buy", response_model=TradeResponse)
async def buy_stock(name: str, request: TradeRequest):
    """Buy shares in a portfolio."""
    try:
        trade = portfolio_service.buy(
            name=name,
            symbol=request.symbol,
            qty=request.qty,
            price=request.price,
            reason="manual",
        )
        return TradeResponse(
            id=trade.id,
            portfolio=trade.portfolio,
            symbol=trade.symbol,
            side=trade.side,
            qty=trade.qty,
            price=trade.price,
            timestamp=trade.timestamp,
            reason=trade.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{name}/sell", response_model=TradeResponse)
async def sell_stock(name: str, request: TradeRequest):
    """Sell shares in a portfolio."""
    try:
        trade = portfolio_service.sell(
            name=name,
            symbol=request.symbol,
            qty=request.qty,
            price=request.price,
            reason="manual",
        )
        return TradeResponse(
            id=trade.id,
            portfolio=trade.portfolio,
            symbol=trade.symbol,
            side=trade.side,
            qty=trade.qty,
            price=trade.price,
            timestamp=trade.timestamp,
            reason=trade.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{name}/value", response_model=PortfolioValueResponse)
async def get_portfolio_value(name: str):
    """Get the current valuation of a portfolio."""
    portfolio = portfolio_service.get_portfolio(name)
    if not portfolio:
        raise HTTPException(status_code=404, detail=f"Portfolio '{name}' not found")
    value = portfolio_service.value_portfolio(portfolio)
    return value


@router.get("/{name}/performance", response_model=PerformanceResponse)
async def get_portfolio_performance(name: str):
    """Get performance metrics and history for a portfolio."""
    portfolio = portfolio_service.get_portfolio(name)
    if not portfolio:
        raise HTTPException(status_code=404, detail=f"Portfolio '{name}' not found")
    # For now, we return empty history and zero metrics as we don't have history implemented
    return PerformanceResponse(
        history=portfolio_service.portfolio_history(name),
        total_return=0.0,
        win_rate=0.0,
        sharpe=None,
    )


@router.get("/ultron/decision", response_model=DecisionResponse)
async def get_ultron_decision():
    """Get AI trading decision for Ultron portfolio (no execution)."""
    # For now, we return a placeholder decision.
    # In the future, this will call the analysis/Hermes API to get a decision.
    return DecisionResponse(
        action="HOLD",
        symbol="",
        qty=0.0,
        confidence=0.0,
        reason="AI decision logic not yet implemented",
    )


@router.post("/ultron/auto-trade", response_model=AutoTradeResponse)
async def ultron_auto_trade():
    """Run analysis -> decision -> execute trade for Ultron portfolio if confidence >= 0.7."""
    # For now, we return a placeholder.
    # In the future, this will:
    # 1. Get analysis/consensus for a symbol (maybe we need to decide which symbol? The spec doesn't specify.)
    # 2. Use the decision function to get action, symbol, qty, confidence, reason.
    # 3. If confidence >= 0.7 and action is BUY/SELL, execute the trade.
    # 4. Return the decision and the trade (if executed) plus trace.
    # Since we don't have a specific symbol to analyze, we'll return a placeholder.
    decision = DecisionResponse(
        action="HOLD",
        symbol="",
        qty=0.0,
        confidence=0.0,
        reason="Auto-trade logic not yet implemented",
    )
    return AutoTradeResponse(
        decision=decision,
        trade=None,
        trace={"note": "Auto-trade not implemented"},
    )