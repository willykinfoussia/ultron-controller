import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Table, Form, Input, InputNumber, Select, Switch, Alert, Spin, message } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, Area } from 'recharts';
import { BarChart, Bar } from 'recharts';
import { ultronApi } from '../api/ultron';
import { Portfolio, Holding, Transaction, AnalysisSignal, PerformanceMetrics } from '../types/ultron';
import PortfolioManager from '../components/ultron/PortfolioManager';
import HoldingsTable from '../components/ultron/HoldingsTable';
import TransactionHistory from '../components/ultron/TransactionHistory';
import AnalysisPanel from '../components/ultron/AnalysisPanel';
import AIControlPanel from '../components/ultron/AIControlPanel';
import PerformanceCharts from '../components/ultron/PerformanceCharts';

const UltronPage: React.FC = () => {
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisSignal[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      const data = await ultronApi.getPortfolios();
      setPortfolios(data);
      if (data.length > 0 && !portfolioId) {
        setSelectedPortfolio(data[0]);
        setPortfolioId(data[0].id);
        loadPortfolioData(data[0].id);
      }
    } catch (err) {
      message.error('Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioData = async (id: string) => {
    try {
      const [holdingsData, transactionsData, analysisData, performanceData] = await Promise.all([
        ultronApi.getHoldings(id),
        ultronApi.getTransactions(id),
        ultronApi.getAnalysis(id),
        ultronApi.getPerformance(id)
      ]);
      setHoldings(holdingsData);
      setTransactions(transactionsData);
      setAnalysis(analysisData);
      setPerformance(performanceData);
    } catch (err) {
      message.error('Failed to load portfolio data');
    }
  };

  const handlePortfolioSelect = (id: string) => {
    setPortfolioId(id);
    const portfolio = portfolios.find(p => p.id === id) || null;
    setSelectedPortfolio(portfolio);
    loadPortfolioData(id);
  };

  if (loading) {
    return <Spin tip="Loading Ultron Dashboard..." />;
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Button type="primary" onClick={() => navigate('/ultron/create-portfolio')}>
          Create New Portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <Alert message="No portfolios created yet. Create your first portfolio to get started." type="info" showIcon />
      ) : (
        <>
          <Row gutter={16}>
            <Col md={8} lg={4}>
              <PortfolioManager 
                portfolios={portfolios} 
                selectedPortfolio={selectedPortfolio}
                onPortfolioSelect={handlePortfolioSelect}
                onCreatePortfolio={() => navigate('/ultron/create-portfolio')}
              />
            </Col>
            <Col md={16} lg={8}>
              {selectedPortfolio ? (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Card title="Holdings">
                        <HoldingsTable 
                          holdings={holdings} 
                          onHoldingsUpdate={loadPortfolioData} 
                        />
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card title="Analysis & Signals">
                        <AnalysisPanel signals={analysis} />
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={24}>
                      <Card title="AI Trading Control">
                        <AIControlPanel 
                          portfolioId={selectedPortfolio!.id} 
                          onAnalysisComplete={loadPortfolioData} 
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Card title="Transaction History">
                        <TransactionHistory 
                          transactions={transactions} 
                          portfolioId={selectedPortfolio!.id}
                          onTransactionsUpdate={() => loadPortfolioData(selectedPortfolio!.id)}
                        />
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card title="Performance Charts">
                        <PerformanceCharts 
                          performance={performance} 
                          holdings={holdings} 
                        />
                      </Card>
                    </Col>
                  </Row>
                </>
              ) : (
                <Alert message="Select a portfolio to view details" type="info" showIcon />
              )}
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default UltronPage;