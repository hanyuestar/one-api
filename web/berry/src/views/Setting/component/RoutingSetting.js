import { useState, useEffect } from 'react';
import SubCard from 'ui-component/cards/SubCard';
import {
  Stack,
  Button,
  TextField,
  MenuItem,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Divider
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { showError, showSuccess, verifyJSON } from 'utils/common';
import { API } from 'utils/api';

// v1.1 F-004 路由策略 / F-005 虚拟模型 管理（berry 主题，MUI）

const strategyOptions = [
  { value: 'priority', label: 'priority（按优先级，默认）' },
  { value: 'weighted', label: 'weighted（按渠道权重）' },
  { value: 'latency', label: 'latency（延迟优先）' },
  { value: 'random', label: 'random（随机）' }
];

const emptyPolicy = { group: '', model: '', strategy: 'priority', config: '' };
const emptyVirtual = {
  name: '',
  description: '',
  strategy: 'weighted',
  config: '',
  enabled: true
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
        API.get('/api/virtual-models/')
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
      config: p.config || ''
    });
    setPolicyModal(true);
  };

  const savePolicy = async () => {
    if (policyForm.group === '') {
      showError('分组不能为空');
      return;
    }
    if (policyForm.model === '') {
      showError('模型不能为空');
      return;
    }
    if (policyForm.config !== '' && !verifyJSON(policyForm.config)) {
      showError('配置参数不是合法 JSON');
      return;
    }
    const payload = { ...policyForm };
    const res =
      editingPolicyId > 0
        ? await API.put(`/api/routing-policy/${editingPolicyId}`, payload)
        : await API.post('/api/routing-policy/', payload);
    if (res.data.success) {
      showSuccess('操作成功');
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
      enabled: v.enabled
    });
    setVmModal(true);
  };

  const saveVm = async () => {
    if (vmForm.name === '') {
      showError('名称不能为空');
      return;
    }
    if (vmForm.config !== '' && !verifyJSON(vmForm.config)) {
      showError('候选配置不是合法 JSON');
      return;
    }
    const payload = { ...vmForm };
    const res =
      editingVmId > 0
        ? await API.put(`/api/virtual-models/${editingVmId}`, payload)
        : await API.post('/api/virtual-models/', payload);
    if (res.data.success) {
      showSuccess('操作成功');
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
      showSuccess('操作成功');
      setDeleteId(0);
      loadData().then();
    } else {
      showError(res.data.message);
    }
  };

  const PolicyTable = (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>分组</TableCell>
            <TableCell>模型</TableCell>
            <TableCell>策略</TableCell>
            <TableCell>配置参数</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {policies.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="textSecondary">
                  暂无路由策略
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {policies.map((p) => (
            <TableRow key={p.id} hover>
              <TableCell>{p.id}</TableCell>
              <TableCell>{p.group}</TableCell>
              <TableCell>{p.model}</TableCell>
              <TableCell>{p.strategy}</TableCell>
              <TableCell>
                {p.config
                  ? p.config.length > 40
                    ? p.config.slice(0, 40) + '...'
                    : p.config
                  : '-'}
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Button size="small" onClick={() => openEditPolicy(p)}>
                    <IconEdit size={16} />
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setDeleteId(p.id);
                      setDeleteType('policy');
                    }}
                  >
                    <IconTrash size={16} />
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const VmTable = (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>名称</TableCell>
            <TableCell>描述</TableCell>
            <TableCell>策略</TableCell>
            <TableCell>启用</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {virtualModels.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="textSecondary">
                  暂无虚拟模型
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {virtualModels.map((v) => (
            <TableRow key={v.id} hover>
              <TableCell>{v.id}</TableCell>
              <TableCell>{v.name}</TableCell>
              <TableCell>{v.description || '-'}</TableCell>
              <TableCell>{v.strategy}</TableCell>
              <TableCell>{v.enabled ? '是' : '否'}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Button size="small" onClick={() => openEditVm(v)}>
                    <IconEdit size={16} />
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setDeleteId(v.id);
                      setDeleteType('virtual');
                    }}
                  >
                    <IconTrash size={16} />
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <>
      <SubCard title="路由策略">
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          按 (分组, 模型) 配置渠道选择策略，支持 * 通配
        </Typography>
        <Stack direction="row" sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<IconPlus />} onClick={openAddPolicy}>
            添加策略
          </Button>
        </Stack>
        {PolicyTable}
      </SubCard>
      <Divider sx={{ my: 2 }} />
      <SubCard title="虚拟模型">
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          将多个真实模型聚合为一个入口，运行时按权重选择实际模型
        </Typography>
        <Stack direction="row" sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<IconPlus />} onClick={openAddVm}>
            添加虚拟模型
          </Button>
        </Stack>
        {VmTable}
      </SubCard>

      {/* 路由策略弹窗 */}
      <Dialog open={policyModal} onClose={() => setPolicyModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPolicyId > 0 ? '编辑策略' : '添加策略'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="分组"
              value={policyForm.group}
              placeholder="default / *"
              onChange={(e) => setPolicyForm((f) => ({ ...f, group: e.target.value }))}
              size="small"
            />
            <TextField
              label="模型"
              value={policyForm.model}
              placeholder="gpt-4o / *"
              onChange={(e) => setPolicyForm((f) => ({ ...f, model: e.target.value }))}
              size="small"
            />
            <TextField
              select
              label="策略"
              value={policyForm.strategy}
              onChange={(e) => setPolicyForm((f) => ({ ...f, strategy: e.target.value }))}
              size="small"
            >
              {strategyOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="配置参数"
              value={policyForm.config}
              placeholder='{"example": 1}'
              onChange={(e) => setPolicyForm((f) => ({ ...f, config: e.target.value }))}
              multiline
              minRows={3}
              size="small"
              inputProps={{ style: { fontFamily: 'JetBrains Mono, Consolas' } }}
            />
            <Alert severity="info">
              group/model 支持 * 通配；匹配优先级：精确匹配 &gt; 分组通配 &gt; 模型通配 &gt; 全通配（* / *）
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyModal(false)}>取消</Button>
          <Button variant="contained" onClick={savePolicy}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 虚拟模型弹窗 */}
      <Dialog open={vmModal} onClose={() => setVmModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVmId > 0 ? '编辑虚拟模型' : '添加虚拟模型'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="名称"
              value={vmForm.name}
              placeholder="gpt-family"
              onChange={(e) => setVmForm((f) => ({ ...f, name: e.target.value }))}
              size="small"
            />
            <TextField
              label="描述"
              value={vmForm.description}
              onChange={(e) => setVmForm((f) => ({ ...f, description: e.target.value }))}
              size="small"
            />
            <TextField
              label="候选配置"
              value={vmForm.config}
              placeholder='[{"model": "gpt-4o", "channel_id": 0, "weight": 3}]'
              onChange={(e) => setVmForm((f) => ({ ...f, config: e.target.value }))}
              multiline
              minRows={5}
              size="small"
              inputProps={{ style: { fontFamily: 'JetBrains Mono, Consolas' } }}
            />
            <FormControl component="fieldset">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={vmForm.enabled}
                    onChange={(e) => setVmForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                }
                label="启用"
              />
              <FormHelperText sx={{ mt: 0.5 }}>
                关闭后该虚拟模型将不参与模型解析与路由
              </FormHelperText>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVmModal(false)}>取消</Button>
          <Button variant="contained" onClick={saveVm}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={deleteId > 0} onClose={() => setDeleteId(0)} maxWidth="xs" fullWidth>
        <DialogTitle>确认</DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定要删除该项吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(0)}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RoutingSetting;
