import React from 'react';
import { Card, Tag, Spin } from 'antd';
import { AnalysisSignal } from '../../types/ultron';

interface AnalysisPanelProps {
  signals: AnalysisSignal[];
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ signals }) => {
  if (signals.length === 0) {
    return (
      <Card title="Analysis & Signals">
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          No analysis signals available.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Analysis & Signals">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {signals.map((signal, index) => (
          <div key={index} style={{ borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{signal.symbol}</strong>
                <span style={{ marginLeft: '8px' }}>
                  <Tag 
                    color={signal.signal === 'BUY' ? 'green' : signal.signal === 'SELL' ? 'red' : 'orange'}
                  >
                    {signal.signal}
                  </Tag>
                </span>
              </div>
              <div>
                <span>Confidence: {(signal.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ marginTop: '4px', color: '#666', fontSize: '14px' }}>
              {signal.explanation}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
              {new Date(signal.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default AnalysisPanel;