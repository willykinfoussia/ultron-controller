import { request } from './client';
import { Portfolio, Position, PortfolioValuation, TradeDecision } from './types';

export async function listPortfolios(): Promise<Portfolio[]> {
  return request<Portfolio[]>('/api/portfolio');
}

export async function getPortfolio(name: string): Promise<Portfolio> {
  return request<Portfolio>(`/api/portfolio/${encodeURIComponent(name)}`);
}

export async function createPortfolio(name: string, initial_cash: number, mode: string): Promise<Portfolio> {
  return request<Portfolio>('/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, initial_cash, mode }),
  });
}

export async function buyPortfolio(name: string, symbol: string, qty: number, price?: number): Promise<void> {
  return request<void>(`/api/portfolio/${encodeURIComponent(name)}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, qty, price }),
  });
}

export async function sellPortfolio(name: string, symbol: string, qty: number, price?: number): Promise<void> {
  return request<void>(`/api/portfolio/${encodeURIComponent(name)}/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, qty, price }),
  });
}

export async function getPortfolioPerformance(name: string): Promise<PortfolioValuation> {
  return request<PortfolioValuation>(`/api/portfolio/${encodeURIComponent(name)}/performance`);
}

export async function getUltronDecision(): Promise<TradeDecision> {
  return request<TradeDecision>('/api/portfolio/ultron/decision');
}

export async function autoTradeUltron(): Promise<void> {
  return request<void>('/api/portfolio/ultron/auto-trade', { method: 'POST' });
}