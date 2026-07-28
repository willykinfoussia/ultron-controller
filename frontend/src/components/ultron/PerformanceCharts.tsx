import React from 'react';
import { Card, Spin, message } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, Area } from 'recharts';
import { BarChart, Bar, XAxis as BarXAxis, YAxis as BarYAxis } from 'recharts';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend as PieLegend, ResponsiveContainer } from 'recharts';
import { PerformanceMetrics } from '../../types/ultron';

interface PerformanceChartsProps {
  performance: PerformanceMetrics | null;
  holdings: any[]; // Holding[] but we'll keep it generic for now
}

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ performance, holdings }) => {
  if (!performance) {
    return (
      <Card title="Performance Charts">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          No performance data available.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Performance Charts">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Equity Curve */}
        <div>
          <h3>Equity Curve</h3>
          <LineChart 
            width={600} 
            height={300} 
            data={performance.equity_curve.map((item, index) => ({
              ...item,
              name: `Day ${index + 1}`
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip />
            <RechartsLegend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
          </LineChart>
        </div>

        {/* Daily Returns */}
        <div>
          <h3>Daily Returns</h3>
          <BarChart 
            width={600} 
            height={300} 
            data={performance.daily_returns.map((item, index) => ({
              ...item,
              name: `Day ${index + 1}`
            }))}
          >
            <BarXAxis dataKey="date" />
            <BarYAxis />
            <RechartsTooltip />
            <RechartsLegend />
            <Bar dataKey="return" fill="#82ca9d" />
          </BarChart>
        </div>

        {/* Drawdown */}
        <div>
          <h3>Drawdown</h3>
          <LineChart 
            width={600} 
            height={300} 
            data={performance.drawdown.map((item, index) => ({
              ...item,
              name: `Day ${index + 1}`
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip />
            <RechartsLegend />
            <Line type="monotone" dataKey="drawdown" stroke="#ff7300" activeDot={{ r: 8 }} />
            <Area type="monotone" dataKey="drawdown" stroke="#ff7300" fillOpacity={0.1} />
          </LineChart>
        </div>

        {/* Asset Allocation */}
        <div>
          <h3>Asset Allocation</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PieChart width={400} height={400}>
              <PieTooltip />
              <PieLegend />
              <Pie 
                data={performance.allocation.map((item, index) => ({
                  name: item.symbol,
                  value: item.value,
                }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={150}
                labelLine={false}
              >
                {performance.allocation.map((_, index) => {
                  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
                  return (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  );
                })}
              </Pie>
            </PieChart>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PerformanceCharts;