export interface Portfolio {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export interface Trade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  portfolio_id: string;
}

export interface PortfolioValuation {
  total: number;
  cash: number;
  invested: number;
  pnl: number;
  pnl_pct: number;
  positions: Position[];
}

export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  qty: number;
  confidence: number;
  reason: string;
}