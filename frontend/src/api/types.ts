export interface AnalysisResult {
  method_id: string;
  method_name: string;
  category: string;
  symbol: string;
  result: Record<string, unknown>;
  signal: 'buy' | 'sell' | 'hold' | 'neutral';
  confidence: number;
  explanation: string;
  chart_data: Record<string, unknown> | null;
  computed_at: string;
}

export interface AnalysisMethod {
  method_id: string;
  method_name: string;
  category: string;
  description: string;
  parameters: Record<string, { type: string; default: unknown; description: string }>;
}
