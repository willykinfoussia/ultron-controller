export interface Portfolio {
  id: string;
  name: string;
  initial_cash: number;
  current_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  average_cost: number;
  current_price: number;
  current_value: number;
  pnl: number;
  pnl_percent: number;
}

export interface Transaction {
  id: string;
  portfolio_id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  fees: number;
}

export interface AnalysisSignal {
  id: string;
  portfolio_id: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  explanation: string;
  timestamp: string;
}

export interface PerformanceMetrics {
  portfolio_id: string;
  equity_curve: Array<{ date: string; value: number }>;
  daily_returns: Array<{ date: string; return: number }>;
  drawdown: Array<{ date: string; drawdown: number }>;
  allocation: Array<{ symbol: string; value: number }>;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
}
