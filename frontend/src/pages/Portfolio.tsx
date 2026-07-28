import { useCallback, useEffect, useState, useContext } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Row, Space, Table, Switch, Tag, Dropdown, Menu, Select, Spin } from 'antd';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Portfolio, Position, PortfolioValuation, TradeDecision } from '../api/types';
import { listPortfolios, getPortfolio, createPortfolio, buyPortfolio, sellPortfolio, getPortfolioPerformance, getUltronDecision, autoTradeUltron } from '../api/portfolio';
import { ToastKind } from '../components/Toast';

interface PortfolioPageProps {
  setToast: (message: string, kind?: ToastKind) => void;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ setToast }) => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [portfolioData, setPortfolioData] = useState<PortfolioValuation | null>(null);
  const [performanceData, setPerformanceData] = useState<Array<{ date: string; value: number }>>([]);
  const [ultronDecision, setUltronDecision] = useState<TradeDecision | null>(null);
  const [ultronResult, setUltronResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [newPortfolioName, setNewPortfolioName] = useState<string>('');
  const [newPortfolioCash, setNewPortfolioCash] = useState<number>(0);
  const [newPortfolioMode, setNewPortfolioMode] = useState<string>('paper');
  const [buySymbol, setBuySymbol] = useState<string>('');
  const [buyQuantity, setBuyQuantity] = useState<number>(0);
  const [buyPrice, setBuyPrice] = useState<number | undefined>(undefined);
  const [sellSymbol, setSellSymbol] = useState<string>('');
  const [sellQuantity, setSellQuantity] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number | undefined>(undefined);

  const fetchPortfolios = useCallback(async () => {
    try {
      const data = await listPortfolios();
      setPortfolios(data);
      if (data.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(data[0].name);
      }
    } catch (err) {
      setToast(`Failed to load portfolios: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [setToast]);

  const fetchPortfolioData = useCallback(async (name: string) => {
    try {
      setLoading(true);
      const data = await getPortfolio(name);
      setPortfolioData(data as unknown as PortfolioValuation);
      // Fetch performance data (for simplicity, we'll just get current valuation and assume we have history)
      const perf = await getPortfolioPerformance(name);
      // For now, we'll just use current total as a single point; in a real app we'd have historical data
      setPerformanceData([{ date: new Date().toISOString().split('T')[0], value: perf.total }]);
    } catch (err) {
      setToast(`Failed to load portfolio data: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [setToast]);

  const fetchUltronDecision = useCallback(async () => {
    try {
      const decision = await getUltronDecision();
      setUltronDecision(decision);
    } catch (err) {
      setToast(`Failed to get Ultron decision: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [setToast]);

  const handleCreatePortfolio = useCallback(async () => {
    if (!newPortfolioName.trim() || newPortfolioCash <= 0) {
      setToast('Please provide a valid name and initial cash amount', 'warning');
      return;
    }
    try {
      await createPortfolio(newPortfolioName, newPortfolioCash, newPortfolioMode);
      setToast(`Portfolio '${newPortfolioName}' created successfully`, 'success');
      setNewPortfolioName('');
      setNewPortfolioCash(0);
      setNewPortfolioMode('paper');
      await fetchPortfolios();
    } catch (err) {
      setToast(`Failed to create portfolio: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [newPortfolioName, newPortfolioCash, newPortfolioMode, setToast, fetchPortfolios]);

  const handleBuy = useCallback(async () => {
    if (!selectedPortfolio || !buySymbol || buyQuantity <= 0) {
      setToast('Please select a portfolio and provide valid symbol and quantity', 'warning');
      return;
    }
    try {
      await buyPortfolio(selectedPortfolio, buySymbol, buyQuantity, buyPrice);
      setToast(`Buy order placed for ${buyQuantity} ${buySymbol}`, 'success');
      setBuySymbol('');
      setBuyQuantity(0);
      setBuyPrice(undefined);
      await fetchPortfolioData(selectedPortfolio);
    } catch (err) {
      setToast(`Failed to buy: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [selectedPortfolio, buySymbol, buyQuantity, buyPrice, setToast, fetchPortfolioData]);

  const handleSell = useCallback(async () => {
    if (!selectedPortfolio || !sellSymbol || sellQuantity <= 0) {
      setToast('Please select a portfolio and provide valid symbol and quantity', 'warning');
      return;
    }
    try {
      await sellPortfolio(selectedPortfolio, sellSymbol, sellQuantity, sellPrice);
      setToast(`Sell order placed for ${sellQuantity} ${sellSymbol}`, 'success');
      setSellSymbol('');
      setSellQuantity(0);
      setSellPrice(undefined);
      await fetchPortfolioData(selectedPortfolio);
    } catch (err) {
      setToast(`Failed to sell: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [selectedPortfolio, sellSymbol, sellQuantity, sellPrice, setToast, fetchPortfolioData]);

  const handleUltronTrade = useCallback(async () => {
    try {
      setUltronResult('Executing...');
      await autoTradeUltron();
      setUltronResult('Trade executed successfully');
      // Refresh decision and portfolio data
      await fetchUltronDecision();
      await fetchPortfolioData(selectedPortfolio);
    } catch (err) {
      setUltronResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      setToast(`Ultron trade failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [selectedPortfolio, fetchUltronDecision, fetchPortfolioData, setToast]);

  useEffect(() => {
    fetchPortfolios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPortfolio) {
      fetchPortfolioData(selectedPortfolio);
      fetchUltronDecision();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolio]);

  if (loading) {
    return <div className="portfolio-page">Loading...</div>;
  }

  return (
    <div className="portfolio-page">
      <Row gutter={[16, 16]}>
        {/* Portfolio Selector and New Portfolio Form */}
        <Col span={12}>
          <Space direction="vertical" style={{ marginBottom: 16 }}>
            <div>
              <strong>Select Portfolio</strong>
              <Select
                showSearch
                placeholder="Select a portfolio"
                style={{ width: '100%' }}
                value={selectedPortfolio}
                onChange={(value) => setSelectedPortfolio(value)}
                options={portfolios.map(p => ({ label: p.name, value: p.name }))}
              />
            </div>
            <div>
              <strong>Create New Portfolio</strong>
              <Form layout="vertical">
                <Form.Item label="Name">
                  <Input
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    placeholder="Enter portfolio name"
                  />
                </Form.Item>
                <Form.Item label="Initial Cash">
                  <InputNumber
                    value={newPortfolioCash}
                    onChange={(value) => setNewPortfolioCash(value ?? 0)}
                    min={0}
                    precision={2}
                    placeholder="Enter initial cash"
                  />
                </Form.Item>
                <Form.Item label="Mode">
                  <Select
                    value={newPortfolioMode}
                    onChange={(value) => setNewPortfolioMode(value)}
                    placeholder="Select mode"
                  >
                    <Select.Option value="paper">Paper Trading</Select.Option>
                    <Select.Option value="live">Live Trading</Select.Option>
                  </Select>
                </Form.Item>
                <Button type="primary" onClick={handleCreatePortfolio} block>
                  Create Portfolio
                </Button>
              </Form>
            </div>
          </Space>
        </Col>

        {/* Portfolio Summary and Positions */}
        <Col span={12}>
          {portfolioData ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card title="Total Value" extra={<Tag color={portfolioData.pnl >= 0 ? 'green' : 'red'}>${portfolioData.total.toFixed(2)}</Tag>}>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>${portfolioData.total.toFixed(2)}</div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card title="Cash" extra={<Tag color="blue">${portfolioData.cash.toFixed(2)}</Tag>}>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>${portfolioData.cash.toFixed(2)}</div>
                  </Card>
                </Col>
              </Row>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card title="Invested" extra={<Tag color="purple">${portfolioData.invested.toFixed(2)}</Tag>}>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>${portfolioData.invested.toFixed(2)}</div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card title="P&L %" extra={<Tag color={portfolioData.pnl_pct >= 0 ? 'green' : 'red'}>{portfolioData.pnl_pct.toFixed(2)}%</Tag>}>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>{portfolioData.pnl_pct.toFixed(2)}%</div>
                  </Card>
                </Col>
              </Row>

              {/* Positions Table */}
              <Card title="Positions" bordered={true} style={{ marginBottom: 16 }}>
                <Table
                  dataSource={portfolioData.positions}
                  rowKey="symbol"
                  columns={[
                    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
                    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
                    { title: 'Avg Cost', dataIndex: 'avg_price', key: 'avg_price', render: (value: number) => `$${value.toFixed(2)}` },
                    { title: 'Live Price', dataIndex: 'current_price', key: 'current_price', render: (value: number) => `$${value.toFixed(2)}` },
                    { title: 'Current Value', dataIndex: 'market_value', key: 'market_value', render: (value: number) => `$${value.toFixed(2)}` },
                    {
                      title: 'P&L',
                      dataIndex: 'unrealized_pnl',
                      key: 'unrealized_pnl',
                      render: (value: number, record: Position) => (
                        <Tag color={value >= 0 ? 'green' : 'red'}>
                          ${value.toFixed(2)} ({record.unrealized_pnl_pct.toFixed(2)}%)
                        </Tag>
                      ),
                    },
                  ]}
                  pagination={false}
                />
              </Card>

              {/* Buy/Sell Form */}
              <Card title="Trade" bordered={true}>
                <Form layout="vertical">
                  <Form.Item label="Symbol">
                    <Input
                      value={buySymbol}
                      onChange={(e) => setBuySymbol(e.target.value.toUpperCase())}
                      placeholder="Enter stock symbol"
                    />
                  </Form.Item>
                  <Form.Item label="Quantity">
                    <InputNumber
                      value={buyQuantity}
                      onChange={(value) => setBuyQuantity(value ?? 0)}
                      min={0}
                      precision={0}
                      placeholder="Enter quantity"
                    />
                  </Form.Item>
                  <Form.Item label="Price (optional)">
                    <InputNumber
                      value={buyPrice}
                      onChange={(value) => setBuyPrice(value)}
                      min={0}
                      precision={2}
                      placeholder="Enter price (optional, market price if empty)"
                    />
                  </Form.Item>
                  <Space direction="vertical" style={{ marginTop: 16 }}>
                    <Button type="primary" onClick={handleBuy} block>
                      Buy
                    </Button>
                    <Button danger onClick={handleSell} block>
                      Sell
                    </Button>
                  </Space>
                </Form>
              </Card>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p>Select a portfolio to view details</p>
            </div>
          )}
        </Col>
      </Row>

      {/* Performance Chart and Ultron Section */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="Performance Chart" bordered={true}>
            <div style={{ height: 300 }}>
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', paddingTop: '40px', color: '#999' }}>
                  No performance data available
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Ultron AI Trade" bordered={true}>
            <div style={{ marginBottom: 16 }}>
              <strong>Ultron Decision:</strong> {ultronDecision ? (
                <span>
                  {ultronDecision.action} {ultronDecision.symbol} {ultronDecision.qty} shares
                  (Confidence: {ultronDecision.confidence * 100}%)
                </span>
              ) : (
                <span>Loading...</span>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Reason:</strong> {ultronDecision ? ultronDecision.reason : 'N/A'}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Last Trade Result:</strong> {ultronResult || 'No trades yet'}
            </div>
            <Button type="primary" onClick={handleUltronTrade} block>
              Run Daily AI Trade
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PortfolioPage;