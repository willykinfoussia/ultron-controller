import React, { useState } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, Modal, message, Popconfirm, Space } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Holding } from '../../types/ultron';
import { ultronApi } from '../../api/ultron';

interface HoldingsTableProps {
  holdings: Holding[];
  onHoldingsUpdate: () => Promise<void>;
}

const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings, onHoldingsUpdate }) => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentHolding, setCurrentHolding] = useState<Holding | null>(null);

  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Avg Cost',
      dataIndex: 'average_cost',
      key: 'average_cost',
    },
    {
      title: 'Current Price',
      dataIndex: 'current_price',
      key: 'current_price',
    },
    {
      title: 'Current Value',
      dataIndex: 'current_value',
      key: 'current_value',
    },
    {
      title: 'P&L',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (text: number) => (
        <span style={{ color: text >= 0 ? 'green' : 'red' }}>
          {text >= 0 ? `+${text.toFixed(2)}` : text.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'P&L %',
      dataIndex: 'pnl_percent',
      key: 'pnl_percent',
      render: (text: number) => (
        <span style={{ color: text >= 0 ? 'green' : 'red' }}>
          {text >= 0 ? `+${text.toFixed(2)}%` : `${text.toFixed(2)}%`}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Holding) => (
        <Space>
          <Popconfirm
            title="Are you sure you want to delete this holding?"
            onConfirm={() => deleteHolding(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
          <Button size="small" icon={<EditOutlined />} onClick={() => editHolding(record)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  const openAddModal = () => {
    setEditing(false);
    setCurrentHolding(null);
    form.resetFields();
    setVisible(true);
  };

  const editHolding = (holding: Holding) => {
    setEditing(true);
    setCurrentHolding(holding);
    form.setFieldsValue({
      symbol: holding.symbol,
      quantity: holding.quantity,
      averageCost: holding.average_cost,
    });
    setVisible(true);
  };

  const handleAddEdit = async (values: { symbol: string; quantity: number; averageCost: number }) => {
    try {
      if (editing && currentHolding) {
        await ultronApi.updateHolding(currentHolding.id, {
          symbol: values.symbol,
          quantity: values.quantity,
          average_cost: values.averageCost,
        });
        message.success('Holding updated successfully');
      } else {
        // For creating, we need the portfolioId from the holding (which we don't have in this component)
        // In a real app, we would get this from context or props.
        // We'll leave a placeholder and let the parent handle it if needed.
        // However, we can try to get the portfolioId from the first holding if available (assuming same portfolio)
        if (holdings.length > 0) {
          const portfolioId = holdings[0].portfolio_id;
          await ultronApi.addHolding(portfolioId, {
            symbol: values.symbol,
            quantity: values.quantity,
            average_cost: values.averageCost,
            current_price: 0, // placeholder, will be updated by backend
            current_value: 0, // placeholder, will be updated by backend
            pnl: 0, // placeholder, will be updated by backend
            pnl_percent: 0, // placeholder, will be updated by backend
          });
          message.success('Holding added successfully');
        } else {
          message.error('Cannot add holding: no portfolio selected');
        }
      }
      setVisible(false);
      form.resetFields();
      await onHoldingsUpdate();
    } catch (err) {
      message.error('Failed to save holding');
    }
  };

  const deleteHolding = async (id: string) => {
    try {
      await ultronApi.deleteHolding(id);
      message.success('Holding deleted successfully');
      await onHoldingsUpdate();
    } catch (err) {
      message.error('Failed to delete holding');
    }
  };

  const handleCancel = () => {
    setVisible(false);
    form.resetFields();
  };

  return (
    <>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          Add Holding
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={holdings}
        pagination={false}
        rowKey="id"
        loading={false}
      />

      <Modal
        title={editing ? 'Edit Holding' : 'Add Holding'}
        visible={visible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        confirmLoading={false}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddEdit}
        >
          <Form.Item
            label="Symbol"
            name="symbol"
            rules={[{ required: true, message: 'Please input the stock symbol!' }]}
          >
            <Input placeholder="Enter stock symbol (e.g., AAPL)" />
          </Form.Item>
          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: 'Please input the quantity!' }]}
          >
            <InputNumber placeholder="Enter quantity" min={0} precision={6} />
          </Form.Item>
          <Form.Item
            label="Average Cost ($)"
            name="averageCost"
            rules={[{ required: true, message: 'Please input the average cost!' }]}
          >
            <InputNumber placeholder="Enter average cost per share" min={0} precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default HoldingsTable;