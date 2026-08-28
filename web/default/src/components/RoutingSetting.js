import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Form,
  Grid,
  Header,
  Icon,
  Message,
  Modal,
  Table,
} from 'semantic-ui-react';
import { API, showError, showSuccess, verifyJSON } from '../helpers';

// v1.1 F-004 路由策略 / F-005 虚拟模型 管理
// 路由策略：按 (group, model) 选择渠道策略，支持 * 通配
// 虚拟模型：将一组真实模型聚合为一个入口，按权重选择实际模型

const strategyOptions = [
  { key: 'priority', value: 'priority', text: 'priority（按优先级，默认）' },
  { key: 'weighted', value: 'weighted', text: 'weighted（按渠道权重）' },
  { key: 'latency', value: 'latency', text: 'latency（延迟优先）' },
  { key: 'random', value: 'random', text: 'random（随机）' },
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
  const { t } = useTranslation();
  const [policies, setPolicies] = useState([]);
  const [virtualModels, setVirtualModels] = useState([]);
  const [loading, setLoading] = useState(false);

  // 路由策略弹窗
  const [policyModal, setPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState(emptyPolicy);
  const [editingPolicyId, setEditingPolicyId] = useState(0);

  // 虚拟模型弹窗
  const [vmModal, setVmModal] = useState(false);
  const [vmForm, setVmForm] = useState(emptyVirtual);
  const [editingVmId, setEditingVmId] = useState(0);

  const [deleteId, setDeleteId] = useState(0); // 当前待删除 id
  const [deleteType, setDeleteType] = useState(''); // 'policy' | 'virtual'

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
      showError(t('setting.routing.strategy.form.group_required'));
      return;
    }
    if (policyForm.model === '') {
      showError(t('setting.routing.strategy.form.model_required'));
      return;
    }
    if (policyForm.config !== '' && !verifyJSON(policyForm.config)) {
      showError(t('setting.routing.strategy.form.config_invalid'));
      return;
    }
    const payload = { ...policyForm };
    if (editingPolicyId > 0) {
      const res = await API.put(`/api/routing-policy/${editingPolicyId}`, payload);
      if (res.data.success) {
        showSuccess(t('setting.routing.common.success'));
        setPolicyModal(false);
        loadData().then();
      } else {
        showError(res.data.message);
      }
    } else {
      const res = await API.post('/api/routing-policy/', payload);
      if (res.data.success) {
        showSuccess(t('setting.routing.common.success'));
        setPolicyModal(false);
        loadData().then();
      } else {
        showError(res.data.message);
      }
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
      showError(t('setting.routing.virtual.form.name_required'));
      return;
    }
    if (vmForm.config !== '' && !verifyJSON(vmForm.config)) {
      showError(t('setting.routing.virtual.form.config_invalid'));
      return;
    }
    const payload = { ...vmForm };
    if (editingVmId > 0) {
      const res = await API.put(`/api/virtual-models/${editingVmId}`, payload);
      if (res.data.success) {
        showSuccess(t('setting.routing.common.success'));
        setVmModal(false);
        loadData().then();
      } else {
        showError(res.data.message);
      }
    } else {
      const res = await API.post('/api/virtual-models/', payload);
      if (res.data.success) {
        showSuccess(t('setting.routing.common.success'));
        setVmModal(false);
        loadData().then();
      } else {
        showError(res.data.message);
      }
    }
  };

  const confirmDelete = async () => {
    let res;
    if (deleteType === 'policy') {
      res = await API.delete(`/api/routing-policy/${deleteId}`);
    } else {
      res = await API.delete(`/api/virtual-models/${deleteId}`);
    }
    if (res.data.success) {
      showSuccess(t('setting.routing.common.success'));
      setDeleteId(0);
      loadData().then();
    } else {
      showError(res.data.message);
    }
  };

  return (
    <Grid columns={1}>
      <Grid.Column>
        <Form loading={loading}>
          <Header as='h3'>
            {t('setting.routing.strategy.title')}
            <Header.Subheader>
              {t('setting.routing.strategy.subtitle')}
            </Header.Subheader>
          </Header>
          <Button
            primary
            onClick={openAddPolicy}
            style={{ marginBottom: '10px' }}
          >
            <Icon name='plus' />
            {t('setting.routing.strategy.buttons.add')}
          </Button>
          <Table basic='very' compact>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.strategy.group')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.strategy.model')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.strategy.strategy')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.strategy.config')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.strategy.actions')}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {policies.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.id}</Table.Cell>
                  <Table.Cell>{p.group}</Table.Cell>
                  <Table.Cell>{p.model}</Table.Cell>
                  <Table.Cell>{p.strategy}</Table.Cell>
                  <Table.Cell>
                    {p.config
                      ? p.config.length > 40
                        ? p.config.slice(0, 40) + '...'
                        : p.config
                      : '-'}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size='mini'
                      icon='edit'
                      onClick={() => openEditPolicy(p)}
                    />
                    <Button
                      size='mini'
                      icon='trash'
                      color='red'
                      onClick={() => {
                        setDeleteId(p.id);
                        setDeleteType('policy');
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          <Divider />

          <Header as='h3'>
            {t('setting.routing.virtual.title')}
            <Header.Subheader>
              {t('setting.routing.virtual.subtitle')}
            </Header.Subheader>
          </Header>
          <Button
            primary
            onClick={openAddVm}
            style={{ marginBottom: '10px' }}
          >
            <Icon name='plus' />
            {t('setting.routing.virtual.buttons.add')}
          </Button>
          <Table basic='very' compact>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.virtual.name')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.virtual.description')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.virtual.strategy')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.virtual.enabled')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('setting.routing.virtual.actions')}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {virtualModels.map((v) => (
                <Table.Row key={v.id}>
                  <Table.Cell>{v.id}</Table.Cell>
                  <Table.Cell>{v.name}</Table.Cell>
                  <Table.Cell>{v.description || '-'}</Table.Cell>
                  <Table.Cell>{v.strategy}</Table.Cell>
                  <Table.Cell>
                    <Icon
                      name={v.enabled ? 'check circle' : 'times circle'}
                      color={v.enabled ? 'green' : 'grey'}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size='mini'
                      icon='edit'
                      onClick={() => openEditVm(v)}
                    />
                    <Button
                      size='mini'
                      icon='trash'
                      color='red'
                      onClick={() => {
                        setDeleteId(v.id);
                        setDeleteType('virtual');
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Form>

        {/* 路由策略弹窗 */}
        <Modal
          open={policyModal}
          onClose={() => setPolicyModal(false)}
          size='small'
          closeOnDimmerClick={false}
        >
          <Modal.Header>
            {editingPolicyId > 0
              ? t('setting.routing.strategy.buttons.edit')
              : t('setting.routing.strategy.buttons.add')}
          </Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Input
                label={t('setting.routing.strategy.group')}
                placeholder='default / *'
                value={policyForm.group}
                onChange={(e, { value }) =>
                  setPolicyForm((f) => ({ ...f, group: value }))
                }
              />
              <Form.Input
                label={t('setting.routing.strategy.model')}
                placeholder='gpt-4o / *'
                value={policyForm.model}
                onChange={(e, { value }) =>
                  setPolicyForm((f) => ({ ...f, model: value }))
                }
              />
              <Form.Dropdown
                label={t('setting.routing.strategy.strategy')}
                selection
                fluid
                options={strategyOptions}
                value={policyForm.strategy}
                onChange={(e, { value }) =>
                  setPolicyForm((f) => ({ ...f, strategy: value }))
                }
              />
              <Form.TextArea
                label={t('setting.routing.strategy.config')}
                placeholder='{"example": 1}'
                value={policyForm.config}
                style={{ minHeight: 80, fontFamily: 'JetBrains Mono, Consolas' }}
                onChange={(e, { value }) =>
                  setPolicyForm((f) => ({ ...f, config: value }))
                }
              />
              <Message info size='small'>
                {t('setting.routing.strategy.form.wildcard_tip')}
              </Message>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => setPolicyModal(false)}>
              {t('setting.routing.common.cancel')}
            </Button>
            <Button primary onClick={savePolicy}>
              {t('setting.routing.common.save')}
            </Button>
          </Modal.Actions>
        </Modal>

        {/* 虚拟模型弹窗 */}
        <Modal
          open={vmModal}
          onClose={() => setVmModal(false)}
          size='small'
          closeOnDimmerClick={false}
        >
          <Modal.Header>
            {editingVmId > 0
              ? t('setting.routing.virtual.buttons.edit')
              : t('setting.routing.virtual.buttons.add')}
          </Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Input
                label={t('setting.routing.virtual.name')}
                placeholder='gpt-family'
                value={vmForm.name}
                onChange={(e, { value }) =>
                  setVmForm((f) => ({ ...f, name: value }))
                }
              />
              <Form.Input
                label={t('setting.routing.virtual.description')}
                value={vmForm.description}
                onChange={(e, { value }) =>
                  setVmForm((f) => ({ ...f, description: value }))
                }
              />
              <Form.Dropdown
                label={t('setting.routing.virtual.strategy')}
                selection
                fluid
                options={[
                  { key: 'weighted', value: 'weighted', text: 'weighted' },
                ]}
                value={vmForm.strategy}
                onChange={(e, { value }) =>
                  setVmForm((f) => ({ ...f, strategy: value }))
                }
              />
              <Form.TextArea
                label={t('setting.routing.virtual.config')}
                placeholder={t('setting.routing.virtual.form.config_placeholder')}
                value={vmForm.config}
                style={{ minHeight: 160, fontFamily: 'JetBrains Mono, Consolas' }}
                onChange={(e, { value }) =>
                  setVmForm((f) => ({ ...f, config: value }))
                }
              />
              <Form.Checkbox
                checked={vmForm.enabled}
                label={t('setting.routing.virtual.enabled')}
                onChange={(e, { checked }) =>
                  setVmForm((f) => ({ ...f, enabled: checked }))
                }
              />
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(0, 0, 0, 0.55)',
                  marginTop: '4px',
                }}
              >
                {t('setting.routing.virtual.enabled_desc')}
              </div>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => setVmModal(false)}>
              {t('setting.routing.common.cancel')}
            </Button>
            <Button primary onClick={saveVm}>
              {t('setting.routing.common.save')}
            </Button>
          </Modal.Actions>
        </Modal>

        {/* 删除确认 */}
        <Modal open={deleteId > 0} onClose={() => setDeleteId(0)} size='tiny'>
          <Modal.Header>{t('setting.routing.common.confirm')}</Modal.Header>
          <Modal.Content>
            <p>{t('setting.routing.common.delete_confirm_message')}</p>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => setDeleteId(0)}>{t('setting.routing.common.cancel')}</Button>
            <Button color='red' onClick={confirmDelete}>
              {t('setting.routing.common.delete')}
            </Button>
          </Modal.Actions>
        </Modal>
      </Grid.Column>
    </Grid>
  );
};

export default RoutingSetting;
