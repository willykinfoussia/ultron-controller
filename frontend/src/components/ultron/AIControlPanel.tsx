import React, { useState } from 'react';
import { Button, Spin, message, Space, InputNumber, Select, Tag } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseOutlined, RestOutlined } from '@ant-design/icons';
import { ultronApi } from '../../api/ultron';
import { AnalysisSignal } from '../../types/ultron';

interface AIControlPanelProps {
  portfolioId: string;
  onAnalysisComplete: () => void;
}

const AIControlPanel: React.FC<AIControlPanelProps> = ({ portfolioId, onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Array<{ signal: string; confidence: number; explanation: string }>>([]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const analysisResult = await ultronApi.runAnalysis(portfolioId);
      setRecommendations([]);
      // Assuming the analysis result is an array of AnalysisSignal
      // We'll convert to the expected format for display
      const formatted = analysisResult.map((signal: AnalysisSignal) => ({
        signal: signal.signal,
        confidence: signal.confidence,
        explanation: signal.explanation,
      }));
      setRecommendations(formatted);
      message.success('Analysis completed successfully');
      onAnalysisComplete(); // Trigger parent to reload data
    } catch (err) {
      message.error('Failed to run analysis');
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async (signal: { signal: string; confidence: number; explanation: string }) => {
    // In a real app, we would have a form to input quantity, etc.
    // For simplicity, we'll use a fixed quantity of 1 share.
    // We need to know the symbol from the signal, but our recommendation doesn't have symbol.
    // This is a flaw in the current design. Let's assume we have the symbol from the context.
    // Since we don't have the symbol in the recommendation, we cannot execute a trade.
    // We'll show a message that this is a placeholder.
    message.warning('Trade execution requires selecting a specific holding. This is a placeholder.');
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Button 
          type="primary" 
          onClick={runAnalysis}
          loading={loading}
          icon={<RestOutlined />}
        >
          Run AI Analysis
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div>
          <h4>AI Recommendations:</h4>
          <div style={{ marginBottom: '16px' }}>
            {recommendations.map((rec, index) => (
              <div key={index} style={{ border: '1px solid #eee', padding: '12px', marginBottom: '8px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <strong>{rec.signal}</strong> 
                    <Tag color={rec.signal === 'BUY' ? 'green' : rec.signal === 'SELL' ? 'red' : 'orange'}>
                      {rec.signal}
                    </Tag>
                  </span>
                  <span>Confidence: {(rec.confidence * 100).toFixed(1)}%</span>
                </div>
                <p style={{ margin: '8px 0', color: '#666' }}>{rec.explanation}</p>
                <div style={{ textAlign: 'right' }}>
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => executeTrade(rec)}
                  >
                    Execute Trade
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && recommendations.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
          No analysis available. Click "Run AI Analysis" to get recommendations.
        </div>
      )}
    </div>
  );
};

export default AIControlPanel;