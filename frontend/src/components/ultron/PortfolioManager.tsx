import React from 'react';
import { Card, List, Button, Space, Tag } from 'antd';
import { Portfolio } from '../../types/ultron';

interface PortfolioManagerProps {
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  onPortfolioSelect: (id: string) => void;
  onCreatePortfolio: () => void;
}

const PortfolioManager: React.FC<PortfolioManagerProps> = ({ 
  portfolios, 
  selectedPortfolio, 
  onPortfolioSelect,
  onCreatePortfolio
}) => {
  return (
    <Card title="Portfolio Manager" style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <List
          itemLayout="horizontal"
          dataSource={portfolios}
          renderItem={item => (
            <List.Item
              actions={[
                <Button 
                  type={selectedPortfolio?.id === item.id ? 'primary' : 'default'}
                  size="small"
                  onClick={() => onPortfolioSelect(item.id)}
                >
                  Select
                </Button>
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={`Initial: $${item.initial_cash.toLocaleString()} | Value: $${item.current_value.toLocaleString()}`}
              />
              <Tag color={item.total_pnl >= 0 ? 'green' : 'red'}>
                {item.total_pnl >= 0 ? `+${item.total_pnl_percent.toFixed(2)}%` : `${item.total_pnl_percent.toFixed(2)}%`}
              </Tag>
            </List.Item>
          )}
        />
        <div style={{ marginTop: 'auto', padding: '16px' }}>
          <Button type="primary" onClick={onCreatePortfolio}>
            Create New Portfolio
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default PortfolioManager;