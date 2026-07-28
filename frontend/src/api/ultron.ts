import { Portfolio, Holding, Transaction, AnalysisSignal, PerformanceMetrics } from '../types/ultron';

// Base URL for the Ultron API (assuming it's under /api/ultron)
const API_BASE = '/api/ultron';

export const ultronApi = {
  // Portfolio endpoints
  getPortfolios: async (): Promise<Portfolio[]> => {
    const response = await fetch(`${API_BASE}/portfolios`);
    if (!response.ok) throw new Error('Failed to fetch portfolios');
    return response.json();
  },
  createPortfolio: async (name: string, initialCash: number): Promise<Portfolio> => {
    const response = await fetch(`${API_BASE}/portfolios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, initial_cash: initialCash }),
    });
    if (!response.ok) throw new Error('Failed to create portfolio');
    return response.json();
  },
  getPortfolio: async (id: string): Promise<Portfolio> => {
    const response = await fetch(`${API_BASE}/portfolios/${id}`);
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    return response.json();
  },
  updatePortfolio: async (id: string, updates: Partial<Portfolio>): Promise<Portfolio> => {
    const response = await fetch(`${API_BASE}/portfolios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update portfolio');
    return response.json();
  },
  deletePortfolio: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/portfolios/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete portfolio');
  },

  // Holding endpoints
  getHoldings: async (portfolioId: string): Promise<Holding[]> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/holdings`);
    if (!response.ok) throw new Error('Failed to fetch holdings');
    return response.json();
  },
  addHolding: async (portfolioId: string, holding: Omit<Holding, 'id' | 'portfolio_id'>): Promise<Holding> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/holdings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holding),
    });
    if (!response.ok) throw new Error('Failed to add holding');
    return response.json();
  },
  updateHolding: async (holdingId: string, updates: Partial<Holding>): Promise<Holding> => {
    const response = await fetch(`${API_BASE}/holdings/${holdingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update holding');
    return response.json();
  },
  deleteHolding: async (holdingId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/holdings/${holdingId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete holding');
  },

  // Transaction endpoints
  getTransactions: async (portfolioId: string): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/transactions`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },
  addTransaction: async (portfolioId: string, transaction: Omit<Transaction, 'id' | 'portfolio_id'>): Promise<Transaction> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!response.ok) throw new Error('Failed to add transaction');
    return response.json();
  },
  updateTransaction: async (portfolioId: string, transactionId: string, updates: Partial<Transaction>): Promise<Transaction> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/transactions/${transactionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update transaction');
    return response.json();
  },
  deleteTransaction: async (portfolioId: string, transactionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete transaction');
  },

  // Analysis endpoints
  getAnalysis: async (portfolioId: string): Promise<AnalysisSignal[]> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/analysis`);
    if (!response.ok) throw new Error('Failed to fetch analysis');
    return response.json();
  },
  runAnalysis: async (portfolioId: string): Promise<AnalysisSignal[]> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/analysis/run`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to run analysis');
    return response.json();
  },

  // Performance endpoints
  getPerformance: async (portfolioId: string): Promise<PerformanceMetrics> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/performance`);
    if (!response.ok) throw new Error('Failed to fetch performance');
    return response.json();
  },

  // AI Trading endpoints
  getAIRecommendations: async (portfolioId: string): Promise<{ signal: string; confidence: number; explanation: string }[]> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/ai/recommendations`);
    if (!response.ok) throw new Error('Failed to fetch AI recommendations');
    return response.json();
  },
  executeTrade: async (portfolioId: string, trade: { symbol: string; action: 'BUY' | 'SELL'; quantity: number }): Promise<Transaction> => {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}/trades/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    if (!response.ok) throw new Error('Failed to execute trade');
    return response.json();
  },
};