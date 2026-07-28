import React, { useState } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, DatePicker, message, Space, Popconfirm, Modal } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Transaction } from '../../types/ultron';
import { ultronApi } from '../../api/ultron';
import dayjs from 'dayjs';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onTransactionsUpdate: () => Promise<void>;
  portfolioId: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions, onTransactionsUpdate, portfolioId }) => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  // Date range as [startDate, endDate] dayjs objects or null
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => {
        const date = new Date(text);
        return date.toLocaleDateString();
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <span style={{ color: text === 'BUY' ? 'green' : 'red' }}>
          {text}
        </span>
      ),
    },
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
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Transaction) => (
        <Space>
          <Popconfirm
            title="Are you sure you want to delete this transaction?"
            onConfirm={() => deleteTransaction(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
          <Button size="small" icon={<EditOutlined />} onClick={() => editTransaction(record)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  const openAddModal = () => {
    setEditing(false);
    setCurrentTransaction(null);
    form.resetFields();
    setDateRange([null, null]);
    setVisible(true);
  };

  const editTransaction = (transaction: Transaction) => {
    setEditing(true);
    setCurrentTransaction(transaction);
    // Extract date part in 'YYYY-MM-DD' format from timestamp
    const dateString = new Date(transaction.timestamp).toISOString().split('T')[0];
    form.setFieldsValue({
      symbol: transaction.symbol,
      type: transaction.type,
      quantity: transaction.quantity,
      price: transaction.price,
      date: [dateString, dateString],
    });
    setVisible(true);
  };

  const handleAddEdit = async (values: {
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    date: [dayjs.Dayjs | null, dayjs.Dayjs | null];
  }) => {
    try {
      // Use the start date for the timestamp, or if not set, use today's date in 'YYYY-MM-DD'
      const dateString = values.date[0] ? values.date[0].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      // Set timestamp to the start of the day in UTC
      const timestamp = `${dateString}T00:00:00Z`;

      if (editing && currentTransaction) {
        await ultronApi.updateTransaction(portfolioId, currentTransaction.id, {
          symbol: values.symbol,
          type: values.type,
          quantity: values.quantity,
          price: values.price,
          timestamp: timestamp,
          fees: 0, // default fee
        });
        message.success('Transaction updated successfully');
      } else {
        await ultronApi.addTransaction(portfolioId, {
          symbol: values.symbol,
          type: values.type,
          quantity: values.quantity,
          price: values.price,
          timestamp: timestamp,
          fees: 0, // default fee
        });
        message.success('Transaction added successfully');
      }
      setVisible(false);
      form.resetFields();
      setDateRange([null, null]);
      await onTransactionsUpdate();
    } catch (err) {
      message.error('Failed to save transaction');
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await ultronApi.deleteTransaction(portfolioId, id);
      message.success('Transaction deleted successfully');
      await onTransactionsUpdate();
    } catch (err) {
      message.error('Failed to delete transaction');
    }
  };

  const handleCancel = () => {
    setVisible(false);
    form.resetFields();
    setDateRange([null, null]);
  };

  // Filter transactions by date range (comparing date strings in 'YYYY-MM-DD' format)
  const filteredTransactions = transactions.filter(tx => {
    if (!dateRange[0] || !dateRange[1]) return true; // No filter if no date range selected
    const txDate = tx.timestamp.split('T')[0]; // Extract 'YYYY-MM-DD' part
    const start = dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : '';
    const end = dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : '';
    return txDate >= start && txDate <= end;
  });

  return (
    <>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Add Transaction
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Filter by date:</span>
          <DatePicker.RangePicker
            placeholder={['Start date', 'End date']}
            value={dateRange}
            onChange={(dates: any) => {
              setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
            }}
            format="YYYY-MM-DD"
            style={{ width: 300 }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredTransactions}
        pagination={false}
        rowKey="id"
        loading={false}
      />

      <Modal
        title={editing ? 'Edit Transaction' : 'Add Transaction'}
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
            rules={[ { required: true, message: 'Please input the stock symbol!' } ]}
          >
            <Input placeholder="Enter stock symbol (e.g., AAPL)" />
          </Form.Item>
          <Form.Item
            label="Type"
            name="type"
            rules={[ { required: true, message: 'Please select the transaction type!' } ]}
          >
            <Select>
              <Select.Option value="BUY">Buy</Select.Option>
              <Select.Option value="SELL">Sell</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[ { required: true, message: 'Please input the quantity!' } ]}
          >
            <InputNumber placeholder="Enter quantity" min={0} precision={6} />
          </Form.Item>
          <Form.Item
            label="Price ($)"
            name="price"
            rules={[ { required: true, message: 'Please input the price!' } ]}
          >
            <InputNumber placeholder="Enter price per share" min={0} precision={2} />
          </Form.Item>
          <Form.Item
            label="Date"
            name="date"
            valuePropName="value"
            getValueFromEvent={val => val}
          >
            <DatePicker.RangePicker placeholder={['Start date', 'End date']} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TransactionHistory;