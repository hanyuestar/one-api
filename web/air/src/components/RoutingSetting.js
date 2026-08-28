import React, { useEffect, useState } from 'react';
import { Form } from 'semantic-ui-react';
import {
  Banner,
  Button,
  Divider,
  Modal,
  Select,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, verifyJSON } from '../helpers';

// v1.1 F-004 路由策略 / F-005 虚拟模型 管理（air 主题，Semi Design）

const strategyOptions = [
  { value: 'priority', label: 'priority（按优先级，默认）' },
  { value: 'weighted', label: 'weighted（按渠道权重）' },
  { value: 'latency', label: 'latency（延迟优先）' },
  { value: 'random', label: 'random（随机）' },
];

const emptyPolicy = { group: '', model: '', strategy: 'priority', config: '' };
const emptyVirtual = {
  name: '',
  description: '',
  strategy: 'weighted',
  config: '',
  enabled: true,
};

const RoutingSetting = () => {
  const [policies, setPolicies] = useState([]);
  const [virtualModels, setVirtualModels] = useState([]);
  const [loading, setLoading] = useState(false);

  const [policyModal, setPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState(emptyPolicy);
  const [editingPolicyId, setEditingPolicyId] = useState(0);

  const [vmModal, setVmModal] = useState(false);
  const [vmForm, setVmForm] = useState(emptyVirtual);
  const [editingVmId, setEditingVmId] = useState(0);

  const [deleteId, setDeleteId] = useState(0);
  const [deleteType, setDeleteType] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([
        API.get('/api/routing-policy/'),
        API.get('/api/virtual-models/'),
      ]);
      if (pRes.data.success) {
        setPolicies(pRes.data.data || []);
      } else {
        showError(pRes.data.message);
      }
      if (vRes.data.success) {
        setVirtualModels(vRes.data.data || []);
      } else {
        showError(vRes.data.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().then();
  }, []);

  const notify = (msg, type = 'success') => {
    Toast[type](msg);
  };

  const openAddPolicy = () => {
    setEditingPolicyId(0);
    setPolicyForm(emptyPolicy);
    setPolicyModal(true);
  };

  const openEditPolicy = (p) => {
    setEditingPolicyId(p.id);
    setPolicyForm({
      group: p.group,
      model: p.model,
      strategy: p.strategy,
      config: p.config || '',
    });
    setPolicyModal(true);
  };

  const savePolicy = async () => {
    if (policyForm.group === '') {
      notify('分组不能为空', 'warning');
      return;
    }
    if (policyForm.model === '') {
      notify('模型不能为空', 'warning');
      return;
    }
    if (policyForm.config !== '' && !verifyJSON(policyForm.config)) {
      notify('配置参数不是合法 JSON', 'warning');
      return;
    }
    const payload = { ...policyForm };
    const res =
      editingPolicyId > 0
        ? await API.put(`/api/routing-policy/${editingPolicyId}`, payload)
        : await API.post('/api/routing-policy/', payload);
    if (res.data.success) {
      notify('操作成功');
      setPolicyModal(false);
      loadData().then();
    } else {
      showError(res.data.message);
    }
  };

  const openAddVm = () => {
    setEditingVmId(0);
    setVmForm(emptyVirtual);
    setVmModal(true);
  };

  const openEditVm = (v) => {
    setEditingVmId(v.id);
    setVmForm({
      name: v.name,
      description: v.description || '',
      strategy: v.strategy || 'weighted',
      config: v.config || '',
      enabled: v.enabled,
    });
    setVmModal(true);
  };

  const saveVm = async () => {
    if (vmForm.name === '') {
      notify('名称不能为空', 'warning');
      return;
    }
    if (vmForm.config !== '' && !verifyJSON(vmForm.config)) {
      notify('候选配置不是合法 JSON', 'warning');
      return;
    }
    const payload = { ...vmForm };
    const res =
      editingVmId > 0
        ? await API.put(`/api/virtual-models/${editingVmId}`, payload)
        : await API.post('/api/virtual-models/', payload);
    if (res.data.success) {
      notify('操作成功');
      setVmModal(false);
      loadData().then();
    } else {
      showError(res.data.message);
    }
  };

  const confirmDelete = async () => {
    const url =
      deleteType === 'policy'
        ? `/api/routing-policy/${deleteId}`
        : `/api/virtual-models/${deleteId}`;
    const res = await API.delete(url);
    if (res.data.success) {
      notify('操作成功');
      setDeleteId(0);
      loadData().then();
    } else {
      showError(res.data.message);
    }
  };

  const policyColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '分组', dataIndex: 'group' },
    { title: '模型', dataIndex: 'model' },
    { title: '策略', dataIndex: 'strategy', width: 120 },
    {
      title: '配置参数',
      dataIndex: 'config',
      render: (text) =>
        text ? (text.length > 40 ? text.slice(0, 40) + '...' : text) : '-',
    },
    {
      title: '操作',
      dataIndex: 'ops',
      width: 130,
      render: (_, p) => (
        <span>
          <Button
            size='small'
            theme='borderless'
            type='primary'
            icon={<i className='semi-icon semi-icon-edit' />}
            onClick={() => openEditPolicy(p)}
            style={{ marginRight: 6 }}
          >
            编辑
          </Button>
          <Button
            size='small'
            theme='borderless'
            type='danger'
            onClick={() => {
              setDeleteId(p.id);
              setDeleteType('policy');
            }}
          >
            删除
          </Button>
        </span>
      ),
    },
  ];

  const vmColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description', render: (t) => t || '-' },
    { title: '策略', dataIndex: 'strategy', width: 120 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      dataIndex: 'ops',
      width: 130,
      render: (_, v) => (
        <span>
          <Button
            size='small'
            theme='borderless'
            type='primary'
            onClick={() => openEditVm(v)}
            style={{ marginRight: 6 }}
          >
            编辑
          </Button>
          <Button
            size='small'
            theme='borderless'
            type='danger'
            onClick={() => {
              setDeleteId(v.id);
              setDeleteType('virtual');
            }}
          >
            删除
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div>
      <Form loading={loading}>
        <Typography.Title heading={4} style={{ marginBottom: 0 }}>
          路由策略（F-004）
        </Typography.Title>
        <Typography.Text type='tertiary' size='small'>
          按 (分组, 模型) 配置渠道选择策略，支持 * 通配
        </Typography.Text>
        <div style={{ margin: '12px 0' }}>
          <Button theme='solid' type='primary' onClick={openAddPolicy}>
            添加策略
          </Button>
        </div>
        <Table
          columns={policyColumns}
          dataSource={policies}
          rowKey='id'
          pagination={false}
          empty={
            <Typography.Text type='tertiary'>暂无路由策略</Typography.Text>
          }
        />
        <Divider margin='24px' />
        <Typography.Title heading={4} style={{ marginBottom: 0 }}>
          虚拟模型（F-005）
        </Typography.Title>
        <Typography.Text type='tertiary' size='small'>
          将多个真实模型聚合为一个入口，运行时按权重选择实际模型
        </Typography.Text>
        <div style={{ margin: '12px 0' }}>
          <Button theme='solid' type='primary' onClick={openAddVm}>
            添加虚拟模型
          </Button>
        </div>
        <Table
          columns={vmColumns}
          dataSource={virtualModels}
          rowKey='id'
          pagination={false}
          empty={
            <Typography.Text type='tertiary'>暂无虚拟模型</Typography.Text>
          }
        />
      </Form>

      {/* 路由策略弹窗 */}
      <Modal
        title={editingPolicyId > 0 ? '编辑策略' : '添加策略'}
        visible={policyModal}
        onCancel={() => setPolicyModal(false)}
        footer={
          <>
            <Button onClick={() => setPolicyModal(false)}>取消</Button>
            <Button theme='solid' type='primary' onClick={savePolicy}>
              保存
            </Button>
          </>
        }
      >
        <Form>
          <Form.Input
            label='分组'
            value={policyForm.group}
            placeholder='default / *'
            onChange={(v) => setPolicyForm((f) => ({ ...f, group: v }))}
          />
          <Form.Input
            label='模型'
            value={policyForm.model}
            placeholder='gpt-4o / *'
            onChange={(v) => setPolicyForm((f) => ({ ...f, model: v }))}
          />
          <Select
            style={{ width: '100%', marginBottom: 16 }}
            value={policyForm.strategy}
            optionList={strategyOptions}
            onChange={(v) => setPolicyForm((f) => ({ ...f, strategy: v }))}
          />
          <Form.TextArea
            label='配置参数'
            value={policyForm.config}
            placeholder='{"example": 1}'
            style={{ minHeight: 80, fontFamily: 'JetBrains Mono, Consolas' }}
            onChange={(v) => setPolicyForm((f) => ({ ...f, config: v }))}
          />
          <Banner
            type='info'
            description='group/model 支持 * 通配；匹配优先级：精确匹配 > 分组通配 > 模型通配 > 全通配（* / *）'
          />
        </Form>
      </Modal>

      {/* 虚拟模型弹窗 */}
      <Modal
        title={editingVmId > 0 ? '编辑虚拟模型' : '添加虚拟模型'}
        visible={vmModal}
        onCancel={() => setVmModal(false)}
        footer={
          <>
            <Button onClick={() => setVmModal(false)}>取消</Button>
            <Button theme='solid' type='primary' onClick={saveVm}>
              保存
            </Button>
          </>
        }
      >
        <Form>
          <Form.Input
            label='名称'
            value={vmForm.name}
            placeholder='gpt-family'
            onChange={(v) => setVmForm((f) => ({ ...f, name: v }))}
          />
          <Form.Input
            label='描述'
            value={vmForm.description}
            onChange={(v) => setVmForm((f) => ({ ...f, description: v }))}
          />
          <Form.TextArea
            label='候选配置'
            value={vmForm.config}
            placeholder='[{"model": "gpt-4o", "channel_id": 0, "weight": 3}]'
            style={{ minHeight: 160, fontFamily: 'JetBrains Mono, Consolas' }}
            onChange={(v) => setVmForm((f) => ({ ...f, config: v }))}
          />
          <Form.Checkbox
            checked={vmForm.enabled}
            label='启用'
            onChange={(e) => setVmForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginTop: 4 }}>
            关闭后该虚拟模型将不参与模型解析与路由
          </Typography.Text>
        </Form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        title='确认'
        visible={deleteId > 0}
        onCancel={() => setDeleteId(0)}
        footer={
          <>
            <Button onClick={() => setDeleteId(0)}>取消</Button>
            <Button type='danger' theme='solid' onClick={confirmDelete}>
              删除
            </Button>
          </>
        }
      >
        <Typography.Text>确定要删除该项吗？</Typography.Text>
      </Modal>
    </div>
  );
};

export default RoutingSetting;
