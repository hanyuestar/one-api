import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { CHANNEL_OPTIONS } from 'constants/ChannelConstants';
import { useTheme } from '@mui/material/styles';
import { API } from 'utils/api';
import { showError, showSuccess, getChannelModels } from 'utils/common';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  ButtonGroup,
  Container,
  Autocomplete,
  FormHelperText,
  Switch,
  Checkbox
} from '@mui/material';

import { Formik } from 'formik';
import * as Yup from 'yup';
import { defaultConfig, typeConfig } from '../type/Config'; //typeConfig
import { createFilterOptions } from '@mui/material/Autocomplete';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Alert,
  Typography
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

const filter = createFilterOptions();
const validationSchema = Yup.object().shape({
  is_edit: Yup.boolean(),
  name: Yup.string().required('名称 不能为空'),
  type: Yup.number().required('渠道 不能为空'),
  key: Yup.string().when(['is_edit', 'type'], {
    is: (is_edit, type) => !is_edit && type !== 33,
    then: Yup.string().required('密钥 不能为空')
  }),
  other: Yup.string(),
  models: Yup.array().min(1, '模型 不能为空'),
  groups: Yup.array().min(1, '用户组 不能为空'),
  base_url: Yup.string().when('type', {
    is: (value) => [3, 8].includes(value),
    then: Yup.string().required('渠道API地址 不能为空'), // base_url 是必需的
    otherwise: Yup.string() // 在其他情况下，base_url 可以是任意字符串
  }),
  model_mapping: Yup.string().test('is-json', '必须是有效的JSON字符串', function (value) {
    try {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      const parsedValue = JSON.parse(value);
      if (typeof parsedValue === 'object') {
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  })
});

const EditModal = ({ open, channelId, onCancel, onOk }) => {
  const theme = useTheme();
  // const [loading, setLoading] = useState(false);
  const [initialInput, setInitialInput] = useState(defaultConfig.input);
  const [inputLabel, setInputLabel] = useState(defaultConfig.inputLabel); //
  const [inputPrompt, setInputPrompt] = useState(defaultConfig.prompt);
  const [groupOptions, setGroupOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [batchAdd, setBatchAdd] = useState(false);
  const [basicModels, setBasicModels] = useState([]);

  const initChannel = (typeValue) => {
    if (typeConfig[typeValue]?.inputLabel) {
      setInputLabel({
        ...defaultConfig.inputLabel,
        ...typeConfig[typeValue].inputLabel
      });
    } else {
      setInputLabel(defaultConfig.inputLabel);
    }

    if (typeConfig[typeValue]?.prompt) {
      setInputPrompt({
        ...defaultConfig.prompt,
        ...typeConfig[typeValue].prompt
      });
    } else {
      setInputPrompt(defaultConfig.prompt);
    }

    return typeConfig[typeValue]?.input;
  };
  const handleTypeChange = (setFieldValue, typeValue, values) => {
    initChannel(typeValue);
    let localModels = getChannelModels(typeValue);
    setBasicModels(localModels);
    if (localModels.length > 0 && Array.isArray(values['models']) && values['models'].length == 0) {
      setFieldValue('models', initialModel(localModels));
    }

    setFieldValue('config', {});
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      setGroupOptions(res.data.data);
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchModels = async () => {
    try {
      let res = await API.get(`/api/channel/models`);
      const { data } = res.data;
      data.forEach((item) => {
        if (!item.owned_by) {
          item.owned_by = '未知';
        }
      });
      // 先对data排序
      data.sort((a, b) => {
        const ownedByComparison = a.owned_by.localeCompare(b.owned_by);
        if (ownedByComparison === 0) {
          return a.id.localeCompare(b.id);
        }
        return ownedByComparison;
      });

      setModelOptions(
        data.map((model) => {
          return {
            id: model.id,
            group: model.owned_by
          };
        })
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const submit = async (values, { setErrors, setStatus, setSubmitting }) => {
    setSubmitting(true);
    if (values.base_url && values.base_url.endsWith('/')) {
      values.base_url = values.base_url.slice(0, values.base_url.length - 1);
    }
    if (values.type === 3 && values.other === '') {
      values.other = '2023-09-01-preview';
    }
    if (values.type === 18 && values.other === '') {
      values.other = 'v2.1';
    }
    if (values.key === '') {
      if (values.config.ak && values.config.sk && values.config.region) {
        values.key = `${values.config.ak}|${values.config.sk}|${values.config.region}`;
      } else if (values.config.region && values.config.vertex_ai_project_id && values.config.vertex_ai_adc) {
        values.key = `${values.config.region}|${values.config.vertex_ai_project_id}|${values.config.vertex_ai_adc}`;
      }
    }

    let res;
    const modelsStr = values.models.map((model) => model.id).join(',');
    const configStr = JSON.stringify(values.config);
    values.group = values.groups.join(',');
    if (channelId) {
      res = await API.put(`/api/channel/`, {
        ...values,
        id: parseInt(channelId),
        models: modelsStr,
        config: configStr
      });
    } else {
      res = await API.post(`/api/channel/`, { ...values, models: modelsStr, config: configStr });
    }
    const { success, message } = res.data;
    if (success) {
      if (channelId) {
        showSuccess('渠道更新成功！');
      } else {
        showSuccess('渠道创建成功！');
      }
      setSubmitting(false);
      setStatus({ success: true });
      onOk(true);
    } else {
      setStatus({ success: false });
      showError(message);
      setErrors({ submit: message });
    }
  };

  function initialModel(channelModel) {
    if (!channelModel) {
      return [];
    }

    // 如果 channelModel 是一个字符串
    if (typeof channelModel === 'string') {
      channelModel = channelModel.split(',');
    }
    let modelList = channelModel.map((model) => {
      const modelOption = modelOptions.find((option) => option.id === model);
      if (modelOption) {
        return modelOption;
      }
      return { id: model, group: '自定义：点击或回车输入' };
    });
    return modelList;
  }

  const loadChannel = async () => {
    let res = await API.get(`/api/channel/${channelId}`);
    const { success, message, data } = res.data;
    if (success) {
      if (data.models === '') {
        data.models = [];
      } else {
        data.models = initialModel(data.models);
      }
      if (data.group === '') {
        data.groups = [];
      } else {
        data.groups = data.group.split(',');
      }
      if (data.model_mapping !== '') {
        data.model_mapping = JSON.stringify(JSON.parse(data.model_mapping), null, 2);
      }
      if (data.config !== '') {
        data.config = JSON.parse(data.config);
      }

      data.base_url = data.base_url ?? '';
      data.is_edit = true;
      initChannel(data.type);
      setInitialInput(data);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    fetchGroups().then();
    fetchModels().then();
  }, []);

  useEffect(() => {
    setBatchAdd(false);
    if (channelId) {
      loadChannel().then();
      loadKeys().then();
      loadHealth().then();
    } else {
      initChannel(1);
      setInitialInput({ ...defaultConfig.input, is_edit: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // v1.1 F-006 多 Key / F-012 健康诊断
  const [keys, setKeys] = useState([]);
  const [health, setHealth] = useState(null);
  const [keyModal, setKeyModal] = useState(false);
  const [keyForm, setKeyForm] = useState({ key: '', name: '', weight: 1 });
  const [editingKeyId, setEditingKeyId] = useState(0);
  const [deleteKeyId, setDeleteKeyId] = useState(0);

  const loadKeys = async () => {
    if (!channelId) return;
    try {
      const res = await API.get(`/api/channel/${channelId}/keys`);
      if (res.data.success) {
        setKeys(res.data.data || []);
      }
    } catch (error) {
      showError(error.message);
    }
  };

  const loadHealth = async () => {
    if (!channelId) return;
    try {
      const res = await API.get(`/api/channel/${channelId}/health`);
      if (res.data.success) {
        setHealth(res.data.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openAddKey = () => {
    setEditingKeyId(0);
    setKeyForm({ key: '', name: '', weight: 1 });
    setKeyModal(true);
  };

  const openEditKey = (k) => {
    setEditingKeyId(k.id);
    setKeyForm({ key: '', name: k.name, weight: k.weight || 1 });
    setKeyModal(true);
  };

  const saveKey = async () => {
    if (editingKeyId === 0 && keyForm.key === '') {
      showError('Key 不能为空');
      return;
    }
    if (editingKeyId === 0) {
      const res = await API.post(`/api/channel/${channelId}/keys`, keyForm);
      if (res.data.success) {
        showSuccess('操作成功');
        setKeyModal(false);
        loadKeys().then();
      } else {
        showError(res.data.message);
      }
    } else {
      const res = await API.put(`/api/channel/keys/${editingKeyId}`, {
        name: keyForm.name,
        weight: keyForm.weight
      });
      if (res.data.success) {
        showSuccess('操作成功');
        setKeyModal(false);
        loadKeys().then();
      } else {
        showError(res.data.message);
      }
    }
  };

  const confirmDeleteKey = async () => {
    const res = await API.delete(`/api/channel/keys/${deleteKeyId}`);
    if (res.data.success) {
      showSuccess('操作成功');
      setDeleteKeyId(0);
      loadKeys().then();
    } else {
      showError(res.data.message);
    }
  };

  const recoverKeys = async () => {
    const res = await API.post(`/api/channel/${channelId}/keys/recover`);
    if (res.data.success) {
      showSuccess('操作成功');
      loadKeys().then();
    } else {
      showError(res.data.message);
    }
  };

  const keyStatusText = (status) => {
    switch (status) {
      case 2:
        return '禁用';
      case 3:
        return '已隔离';
      default:
        return '启用';
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth={'md'}>
      <DialogTitle
        sx={{
          margin: '0px',
          fontWeight: 700,
          lineHeight: '1.55556',
          padding: '24px',
          fontSize: '1.125rem'
        }}
      >
        {channelId ? '编辑渠道' : '新建渠道'}
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Formik initialValues={initialInput} enableReinitialize validationSchema={validationSchema} onSubmit={submit}>
          {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values, setFieldValue }) => (
            <form noValidate onSubmit={handleSubmit}>
              <FormControl fullWidth error={Boolean(touched.type && errors.type)} sx={{ ...theme.typography.otherInput }}>
                <InputLabel htmlFor="channel-type-label">{inputLabel.type}</InputLabel>
                <Select
                  id="channel-type-label"
                  label={inputLabel.type}
                  value={values.type}
                  name="type"
                  onBlur={handleBlur}
                  onChange={(e) => {
                    handleChange(e);
                    handleTypeChange(setFieldValue, e.target.value, values);
                  }}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200
                      }
                    }
                  }}
                >
                  {Object.values(CHANNEL_OPTIONS)
                    .sort((a, b) => {
                      return a.text.localeCompare(b.text);
                    })
                    .map((option) => {
                      return (
                        <MenuItem key={option.value} value={option.value}>
                          {option.text}
                        </MenuItem>
                      );
                    })}
                </Select>
                {touched.type && errors.type ? (
                  <FormHelperText error id="helper-tex-channel-type-label">
                    {errors.type}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-type-label"> {inputPrompt.type} </FormHelperText>
                )}
              </FormControl>

              <FormControl fullWidth error={Boolean(touched.name && errors.name)} sx={{ ...theme.typography.otherInput }}>
                <InputLabel htmlFor="channel-name-label">{inputLabel.name}</InputLabel>
                <OutlinedInput
                  id="channel-name-label"
                  label={inputLabel.name}
                  type="text"
                  value={values.name}
                  name="name"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  inputProps={{ autoComplete: 'name' }}
                  aria-describedby="helper-text-channel-name-label"
                />
                {touched.name && errors.name ? (
                  <FormHelperText error id="helper-tex-channel-name-label">
                    {errors.name}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-name-label"> {inputPrompt.name} </FormHelperText>
                )}
              </FormControl>

              <FormControl fullWidth error={Boolean(touched.base_url && errors.base_url)} sx={{ ...theme.typography.otherInput }}>
                <InputLabel htmlFor="channel-base_url-label">{inputLabel.base_url}</InputLabel>
                <OutlinedInput
                  id="channel-base_url-label"
                  label={inputLabel.base_url}
                  type="text"
                  value={values.base_url}
                  name="base_url"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  inputProps={{}}
                  aria-describedby="helper-text-channel-base_url-label"
                />
                {touched.base_url && errors.base_url ? (
                  <FormHelperText error id="helper-tex-channel-base_url-label">
                    {errors.base_url}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-base_url-label"> {inputPrompt.base_url} </FormHelperText>
                )}
              </FormControl>

              {inputPrompt.other && (
                <FormControl fullWidth error={Boolean(touched.other && errors.other)} sx={{ ...theme.typography.otherInput }}>
                  <InputLabel htmlFor="channel-other-label">{inputLabel.other}</InputLabel>
                  <OutlinedInput
                    id="channel-other-label"
                    label={inputLabel.other}
                    type="text"
                    value={values.other}
                    name="other"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    inputProps={{}}
                    aria-describedby="helper-text-channel-other-label"
                  />
                  {touched.other && errors.other ? (
                    <FormHelperText error id="helper-tex-channel-other-label">
                      {errors.other}
                    </FormHelperText>
                  ) : (
                    <FormHelperText id="helper-tex-channel-other-label"> {inputPrompt.other} </FormHelperText>
                  )}
                </FormControl>
              )}

              <FormControl fullWidth sx={{ ...theme.typography.otherInput }}>
                <Autocomplete
                  multiple
                  id="channel-groups-label"
                  options={groupOptions}
                  value={values.groups}
                  onChange={(e, value) => {
                    const event = {
                      target: {
                        name: 'groups',
                        value: value
                      }
                    };
                    handleChange(event);
                  }}
                  onBlur={handleBlur}
                  filterSelectedOptions
                  renderInput={(params) => <TextField {...params} name="groups" error={Boolean(errors.groups)} label={inputLabel.groups} />}
                  aria-describedby="helper-text-channel-groups-label"
                />
                {errors.groups ? (
                  <FormHelperText error id="helper-tex-channel-groups-label">
                    {errors.groups}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-groups-label"> {inputPrompt.groups} </FormHelperText>
                )}
              </FormControl>

              <FormControl fullWidth sx={{ ...theme.typography.otherInput }}>
                <Autocomplete
                  multiple
                  freeSolo
                  id="channel-models-label"
                  options={modelOptions}
                  value={values.models}
                  onChange={(e, value) => {
                    const event = {
                      target: {
                        name: 'models',
                        value: value.map((item) => (typeof item === 'string' ? { id: item, group: '自定义：点击或回车输入' } : item))
                      }
                    };
                    handleChange(event);
                  }}
                  onBlur={handleBlur}
                  // filterSelectedOptions
                  disableCloseOnSelect
                  renderInput={(params) => <TextField {...params} name="models" error={Boolean(errors.models)} label={inputLabel.models} />}
                  groupBy={(option) => option.group}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') {
                      return option;
                    }
                    if (option.inputValue) {
                      return option.inputValue;
                    }
                    return option.id;
                  }}
                  filterOptions={(options, params) => {
                    const filtered = filter(options, params);
                    const { inputValue } = params;
                    const isExisting = options.some((option) => inputValue === option.id);
                    if (inputValue !== '' && !isExisting) {
                      filtered.push({
                        id: inputValue,
                        group: '自定义：点击或回车输入'
                      });
                    }
                    return filtered;
                  }}
                  renderOption={(props, option, { selected }) => (
                    <li {...props}>
                      <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
                      {option.id}
                    </li>
                  )}
                />
                {errors.models ? (
                  <FormHelperText error id="helper-tex-channel-models-label">
                    {errors.models}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-models-label"> {inputPrompt.models} </FormHelperText>
                )}
              </FormControl>
              <Container
                sx={{
                  textAlign: 'right'
                }}
              >
                <ButtonGroup variant="outlined" aria-label="small outlined primary button group">
                  <Button
                    onClick={() => {
                      setFieldValue('models', initialModel(basicModels));
                    }}
                  >
                    填入相关模型
                  </Button>
                  <Button
                    onClick={() => {
                      setFieldValue('models', modelOptions);
                    }}
                  >
                    填入所有模型
                  </Button>
                </ButtonGroup>
              </Container>
              {inputLabel.key && (
                <>
                  <FormControl fullWidth error={Boolean(touched.key && errors.key)} sx={{ ...theme.typography.otherInput }}>
                    {!batchAdd ? (
                      <>
                        <InputLabel htmlFor="channel-key-label">{inputLabel.key}</InputLabel>
                        <OutlinedInput
                          id="channel-key-label"
                          label={inputLabel.key}
                          type="text"
                          value={values.key}
                          name="key"
                          onBlur={handleBlur}
                          onChange={handleChange}
                          inputProps={{}}
                          aria-describedby="helper-text-channel-key-label"
                        />
                      </>
                    ) : (
                      <TextField
                        multiline
                        id="channel-key-label"
                        label={inputLabel.key}
                        value={values.key}
                        name="key"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        aria-describedby="helper-text-channel-key-label"
                        minRows={5}
                        placeholder={inputPrompt.key + '，一行一个密钥'}
                      />
                    )}

                    {touched.key && errors.key ? (
                      <FormHelperText error id="helper-tex-channel-key-label">
                        {errors.key}
                      </FormHelperText>
                    ) : (
                      <FormHelperText id="helper-tex-channel-key-label"> {inputPrompt.key} </FormHelperText>
                    )}
                  </FormControl>
                  {channelId === 0 && (
                    <Container
                      sx={{
                        textAlign: 'right'
                      }}
                    >
                      <Switch checked={batchAdd} onChange={(e) => setBatchAdd(e.target.checked)} />
                      批量添加
                    </Container>
                  )}
                </>
              )}

              {inputLabel.config &&
                Object.keys(inputLabel.config).map((configName) => {
                  return (
                    <FormControl key={'config.' + configName} fullWidth sx={{ ...theme.typography.otherInput }}>
                      <TextField
                        multiline
                        key={'config.' + configName}
                        name={'config.' + configName}
                        value={values.config?.[configName] || ''}
                        label={configName}
                        placeholder={inputPrompt.config[configName]}
                        onChange={handleChange}
                      />
                      <FormHelperText id={`helper-tex-config.${configName}-label`}> {inputPrompt.config[configName]} </FormHelperText>
                    </FormControl>
                  );
                })}

              <FormControl fullWidth error={Boolean(touched.model_mapping && errors.model_mapping)} sx={{ ...theme.typography.otherInput }}>
                {/* <InputLabel htmlFor="channel-model_mapping-label">{inputLabel.model_mapping}</InputLabel> */}
                <TextField
                  multiline
                  id="channel-model_mapping-label"
                  label={inputLabel.model_mapping}
                  value={values.model_mapping}
                  name="model_mapping"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  aria-describedby="helper-text-channel-model_mapping-label"
                  minRows={5}
                  placeholder={inputPrompt.model_mapping}
                />
                {touched.model_mapping && errors.model_mapping ? (
                  <FormHelperText error id="helper-tex-channel-model_mapping-label">
                    {errors.model_mapping}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-model_mapping-label"> {inputPrompt.model_mapping} </FormHelperText>
                )}
              </FormControl>
              <FormControl fullWidth error={Boolean(touched.system_prompt && errors.system_prompt)} sx={{ ...theme.typography.otherInput }}>
                {/* <InputLabel htmlFor="channel-model_mapping-label">{inputLabel.model_mapping}</InputLabel> */}
                <TextField
                  multiline
                  id="channel-system_prompt-label"
                  label={inputLabel.system_prompt}
                  value={values.system_prompt}
                  name="system_prompt"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  aria-describedby="helper-text-channel-system_prompt-label"
                  minRows={5}
                  placeholder={inputPrompt.system_prompt}
                />
                {touched.system_prompt && errors.system_prompt ? (
                  <FormHelperText error id="helper-tex-channel-system_prompt-label">
                    {errors.system_prompt}
                  </FormHelperText>
                ) : (
                  <FormHelperText id="helper-tex-channel-system_prompt-label"> {inputPrompt.system_prompt} </FormHelperText>
                )}
              </FormControl>
              {channelId && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h5" gutterBottom>
                    渠道 Key 管理
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    为渠道配置多个上游 Key 实现负载均衡；Key 加密存储，仅展示脱敏后缀
                  </Typography>
                  {health && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      渠道健康状态：健康分 <b>{health.health_score ?? '-'}</b>　
                      熔断状态 <b>{health.circuit?.state ?? '-'}</b>　
                      Key 数量 <b>{health.key_count ?? '-'}</b>　
                      最近探测 <b>{formatTime(health.last_probe_at)}</b>
                    </Alert>
                  )}
                  <Stack direction="row" spacing={1} sx={{ my: 2 }}>
                    <Button size="small" variant="contained" startIcon={<IconPlus />} onClick={openAddKey}>
                      添加 Key
                    </Button>
                    <Button size="small" variant="outlined" onClick={recoverKeys} disabled={!keys.some((k) => k.status === 3)}>
                      恢复隔离 Key
                    </Button>
                  </Stack>
                  <TableContainer>
                    <Table size="small" sx={{ minWidth: 600 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>名称</TableCell>
                          <TableCell>Key</TableCell>
                          <TableCell>权重</TableCell>
                          <TableCell>状态</TableCell>
                          <TableCell>失败次数</TableCell>
                          <TableCell>最近使用</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {keys.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              <Typography variant="body2" color="textSecondary">
                                尚未配置多 Key，当前使用渠道主 Key
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {keys.map((k) => (
                          <TableRow key={k.id} hover>
                            <TableCell>{k.id}</TableCell>
                            <TableCell>{k.name || '-'}</TableCell>
                            <TableCell>{k.key_hint}</TableCell>
                            <TableCell>{k.weight || 1}</TableCell>
                            <TableCell>{keyStatusText(k.status)}</TableCell>
                            <TableCell>{k.fail_count}</TableCell>
                            <TableCell>{formatTime(k.last_used_at)}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <Button size="small" onClick={() => openEditKey(k)}>
                                  <IconEdit size={16} />
                                </Button>
                                <Button size="small" color="error" onClick={() => setDeleteKeyId(k.id)}>
                                  <IconTrash size={16} />
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Dialog
                    open={keyModal}
                    onClose={() => setKeyModal(false)}
                    maxWidth="xs"
                    fullWidth
                  >
                    <DialogTitle>{editingKeyId > 0 ? '编辑 Key' : '添加 Key'}</DialogTitle>
                    <DialogContent>
                      <Stack spacing={2} sx={{ mt: 1 }}>
                        {editingKeyId === 0 && (
                          <TextField
                            label="Key"
                            value={keyForm.key}
                            onChange={(e) => setKeyForm((f) => ({ ...f, key: e.target.value }))}
                            placeholder="请输入上游 API Key"
                            size="small"
                            type="password"
                          />
                        )}
                        <TextField
                          label="名称"
                          value={keyForm.name}
                          onChange={(e) => setKeyForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="可选，用于标识"
                          size="small"
                        />
                        <TextField
                          label="权重"
                          type="number"
                          value={keyForm.weight}
                          onChange={(e) => setKeyForm((f) => ({ ...f, weight: parseInt(e.target.value) }))}
                          size="small"
                        />
                      </Stack>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setKeyModal(false)}>取消</Button>
                      <Button variant="contained" onClick={saveKey}>
                        保存
                      </Button>
                    </DialogActions>
                  </Dialog>
                  <Dialog open={deleteKeyId > 0} onClose={() => setDeleteKeyId(0)} maxWidth="xs" fullWidth>
                    <DialogTitle>确认</DialogTitle>
                    <DialogContent>
                      <Typography variant="body2">确定要删除该项吗？</Typography>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setDeleteKeyId(0)}>取消</Button>
                      <Button variant="contained" color="error" onClick={confirmDeleteKey}>
                        删除
                      </Button>
                    </DialogActions>
                  </Dialog>
                </>
              )}
              <DialogActions>
                <Button onClick={onCancel}>取消</Button>
                <Button disableElevation disabled={isSubmitting} type="submit" variant="contained" color="primary">
                  提交
                </Button>
              </DialogActions>
            </form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
};

export default EditModal;

EditModal.propTypes = {
  open: PropTypes.bool,
  channelId: PropTypes.number,
  onCancel: PropTypes.func,
  onOk: PropTypes.func
};
