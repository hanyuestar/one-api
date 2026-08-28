import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Button,
  Card,
  Divider,
  Form,
  Header,
  Icon,
  Input,
  Message,
  Modal,
  Table,
} from 'semantic-ui-react';
import {useNavigate, useParams} from 'react-router-dom';
import {API, copy, getChannelModels, showError, showInfo, showSuccess, verifyJSON,} from '../../helpers';
import {CHANNEL_OPTIONS} from '../../constants';
import {renderChannelTip} from '../../helpers/render';

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo-0301': 'gpt-3.5-turbo',
  'gpt-4-0314': 'gpt-4',
  'gpt-4-32k-0314': 'gpt-4-32k',
};

function type2secretPrompt(type, t) {
  switch (type) {
    case 15:
      return t('channel.edit.key_prompts.zhipu');
    case 18:
      return t('channel.edit.key_prompts.spark');
    case 22:
      return t('channel.edit.key_prompts.fastgpt');
    case 23:
      return t('channel.edit.key_prompts.tencent');
    default:
      return t('channel.edit.key_prompts.default');
  }
}

const EditChannel = () => {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const channelId = params.id;
  const isEdit = channelId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const handleCancel = () => {
    navigate('/channel');
  };

  const originInputs = {
    name: '',
    type: 1,
    key: '',
    base_url: '',
    other: '',
    model_mapping: '',
    system_prompt: '',
    models: [],
    groups: ['default'],
  };
  const [batch, setBatch] = useState(false);
  const [inputs, setInputs] = useState(originInputs);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [basicModels, setBasicModels] = useState([]);
  const [fullModels, setFullModels] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [config, setConfig] = useState({
    region: '',
    sk: '',
    ak: '',
    user_id: '',
    vertex_ai_project_id: '',
    vertex_ai_adc: '',
  });
  // v1.1 F-006 多 Key / F-012 健康诊断
  const [keys, setKeys] = useState([]);
  const [health, setHealth] = useState(null);
  const [keyModal, setKeyModal] = useState(false);
  const [keyForm, setKeyForm] = useState({ key: '', name: '', weight: 1 });
  const [editingKeyId, setEditingKeyId] = useState(0);
  const [deleteKeyId, setDeleteKeyId] = useState(0);

  const loadKeys = async () => {
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
    try {
      const res = await API.get(`/api/channel/${channelId}/health`);
      if (res.data.success) {
        setHealth(res.data.data);
      }
    } catch (error) {
      // 健康接口为增强能力，失败不阻塞编辑页
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
      showInfo(t('channel.edit.messages.key_required'));
      return;
    }
    const payload = { ...keyForm };
    if (editingKeyId === 0) {
      const res = await API.post(`/api/channel/${channelId}/keys`, payload);
      if (res.data.success) {
        showSuccess(t('common.success'));
        setKeyModal(false);
        loadKeys().then();
      } else {
        showError(res.data.message);
      }
    } else {
      const res = await API.put(`/api/channel/keys/${editingKeyId}`, {
        name: payload.name,
        weight: payload.weight,
      });
      if (res.data.success) {
        showSuccess(t('common.success'));
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
      showSuccess(t('common.success'));
      setDeleteKeyId(0);
      loadKeys().then();
    } else {
      showError(res.data.message);
    }
  };

  const recoverKeys = async () => {
    const res = await API.post(`/api/channel/${channelId}/keys/recover`);
    if (res.data.success) {
      showSuccess(t('common.success'));
      loadKeys().then();
    } else {
      showError(res.data.message);
    }
  };

  const keyStatusText = (status) => {
    switch (status) {
      case 2:
        return t('channel.edit.keys.status_disabled');
      case 3:
        return t('channel.edit.keys.status_quarantined');
      default:
        return t('channel.edit.keys.status_enabled');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };
  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
    if (name === 'type') {
      let localModels = getChannelModels(value);
      if (inputs.models.length === 0) {
        setInputs((inputs) => ({ ...inputs, models: localModels }));
      }
      setBasicModels(localModels);
    }
  };

  const handleConfigChange = (e, { name, value }) => {
    setConfig((inputs) => ({ ...inputs, [name]: value }));
  };

  const loadChannel = async () => {
    let res = await API.get(`/api/channel/${channelId}`);
    const { success, message, data } = res.data;
    if (success) {
      if (data.models === '') {
        data.models = [];
      } else {
        data.models = data.models.split(',');
      }
      if (data.group === '') {
        data.groups = [];
      } else {
        data.groups = data.group.split(',');
      }
      if (data.model_mapping !== '') {
        data.model_mapping = JSON.stringify(
          JSON.parse(data.model_mapping),
          null,
          2
        );
      }
      setInputs(data);
      if (data.config !== '') {
        setConfig(JSON.parse(data.config));
      }
      setBasicModels(getChannelModels(data.type));
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const fetchModels = async () => {
    try {
      let res = await API.get(`/api/channel/models`);
      let localModelOptions = res.data.data.map((model) => ({
        key: model.id,
        text: model.id,
        value: model.id,
      }));
      setOriginModelOptions(localModelOptions);
      setFullModels(res.data.data.map((model) => model.id));
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      setGroupOptions(
        res.data.data.map((group) => ({
          key: group,
          text: group,
          value: group,
        }))
      );
    } catch (error) {
      showError(error.message);
    }
  };

  useEffect(() => {
    let localModelOptions = [...originModelOptions];
    inputs.models.forEach((model) => {
      if (!localModelOptions.find((option) => option.key === model)) {
        localModelOptions.push({
          key: model,
          text: model,
          value: model,
        });
      }
    });
    setModelOptions(localModelOptions);
  }, [originModelOptions, inputs.models]);

  useEffect(() => {
    if (isEdit) {
      loadChannel().then();
      loadKeys().then();
      loadHealth().then();
    } else {
      let localModels = getChannelModels(inputs.type);
      setBasicModels(localModels);
    }
    fetchModels().then();
    fetchGroups().then();
  }, []);

  const submit = async () => {
    if (inputs.key === '') {
      if (config.ak !== '' && config.sk !== '' && config.region !== '') {
        inputs.key = `${config.ak}|${config.sk}|${config.region}`;
      } else if (
        config.region !== '' &&
        config.vertex_ai_project_id !== '' &&
        config.vertex_ai_adc !== ''
      ) {
        inputs.key = `${config.region}|${config.vertex_ai_project_id}|${config.vertex_ai_adc}`;
      }
    }
    if (!isEdit && (inputs.name === '' || inputs.key === '')) {
      showInfo(t('channel.edit.messages.name_required'));
      return;
    }
    if (inputs.type !== 43 && inputs.models.length === 0) {
      showInfo(t('channel.edit.messages.models_required'));
      return;
    }
    if (inputs.model_mapping !== '' && !verifyJSON(inputs.model_mapping)) {
      showInfo(t('channel.edit.messages.model_mapping_invalid'));
      return;
    }
    let localInputs = { ...inputs };
    if (localInputs.key === 'undefined|undefined|undefined') {
      localInputs.key = ''; // prevent potential bug
    }
    if (localInputs.base_url && localInputs.base_url.endsWith('/')) {
      localInputs.base_url = localInputs.base_url.slice(
        0,
        localInputs.base_url.length - 1
      );
    }
    if (localInputs.type === 3 && localInputs.other === '') {
      localInputs.other = '2024-03-01-preview';
    }
    let res;
    localInputs.models = localInputs.models.join(',');
    localInputs.group = localInputs.groups.join(',');
    localInputs.config = JSON.stringify(config);
    if (isEdit) {
      res = await API.put(`/api/channel/`, {
        ...localInputs,
        id: parseInt(channelId),
      });
    } else {
      res = await API.post(`/api/channel/`, localInputs);
    }
    const { success, message } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('channel.edit.messages.update_success'));
      } else {
        showSuccess(t('channel.edit.messages.create_success'));
        setInputs(originInputs);
      }
    } else {
      showError(message);
    }
  };

  const addCustomModel = () => {
    if (customModel.trim() === '') return;
    if (inputs.models.includes(customModel)) return;
    let localModels = [...inputs.models];
    localModels.push(customModel);
    let localModelOptions = [];
    localModelOptions.push({
      key: customModel,
      text: customModel,
      value: customModel,
    });
    setModelOptions((modelOptions) => {
      return [...modelOptions, ...localModelOptions];
    });
    setCustomModel('');
    handleInputChange(null, { name: 'models', value: localModels });
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content>
          <Card.Header className='header'>
            {isEdit
              ? t('channel.edit.title_edit')
              : t('channel.edit.title_create')}
          </Card.Header>
          <Form loading={loading} autoComplete='new-password'>
            <Form.Field>
              <Form.Select
                label={t('channel.edit.type')}
                name='type'
                required
                search
                options={CHANNEL_OPTIONS}
                value={inputs.type}
                onChange={handleInputChange}
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('channel.edit.name')}
                name='name'
                placeholder={t('channel.edit.name_placeholder')}
                onChange={handleInputChange}
                value={inputs.name}
                required
              />
            </Form.Field>
            <Form.Field>
              <Form.Dropdown
                label={t('channel.edit.group')}
                placeholder={t('channel.edit.group_placeholder')}
                name='groups'
                required
                fluid
                multiple
                selection
                allowAdditions
                additionLabel={t('channel.edit.group_addition')}
                onChange={handleInputChange}
                value={inputs.groups}
                autoComplete='new-password'
                options={groupOptions}
              />
            </Form.Field>
            {renderChannelTip(inputs.type)}

            {/* Azure OpenAI specific fields */}
            {inputs.type === 3 && (
              <>
                <Message>
                  注意，<strong>模型部署名称必须和模型名称保持一致</strong>
                  ，因为 One API 会把请求体中的 model
                  参数替换为你的部署名称（模型名称中的点会被剔除），
                  <a
                    target='_blank'
                    href='https://github.com/hanyuestar/one-api/issues/133?notification_referrer_id=NT_kwDOAmJSYrM2NjIwMzI3NDgyOjM5OTk4MDUw#issuecomment-1571602271'
                  >
                    图片演示
                  </a>
                  。
                </Message>
                <Form.Field>
                  <Form.Input
                    label='AZURE_OPENAI_ENDPOINT'
                    name='base_url'
                    placeholder='请输入 AZURE_OPENAI_ENDPOINT，例如：https://docs-test-001.openai.azure.com'
                    onChange={handleInputChange}
                    value={inputs.base_url}
                    autoComplete='new-password'
                  />
                </Form.Field>
                <Form.Field>
                  <Form.Input
                    label='默认 API 版本'
                    name='other'
                    placeholder='请输入默认 API 版本，例如：2024-03-01-preview，该配置可以被实际的请求查询参数所覆盖'
                    onChange={handleInputChange}
                    value={inputs.other}
                    autoComplete='new-password'
                  />
                </Form.Field>
              </>
            )}

            {/* Custom base URL field */}
            {inputs.type === 8 && (
              <Form.Field>
                <Form.Input
                    required
                    label={t('channel.edit.proxy_url')}
                    name='base_url'
                    placeholder={t('channel.edit.proxy_url_placeholder')}
                    onChange={handleInputChange}
                    value={inputs.base_url}
                    autoComplete='new-password'
                />
              </Form.Field>
            )}
            {inputs.type === 50 && (
                <Form.Field>
                  <Form.Input
                      required
                  label={t('channel.edit.base_url')}
                  name='base_url'
                  placeholder={t('channel.edit.base_url_placeholder')}
                  onChange={handleInputChange}
                  value={inputs.base_url}
                  autoComplete='new-password'
                />
              </Form.Field>
            )}

            {inputs.type === 18 && (
              <Form.Field>
                <Form.Input
                  label={t('channel.edit.spark_version')}
                  name='other'
                  placeholder={t('channel.edit.spark_version_placeholder')}
                  onChange={handleInputChange}
                  value={inputs.other}
                  autoComplete='new-password'
                />
              </Form.Field>
            )}
            {inputs.type === 21 && (
              <Form.Field>
                <Form.Input
                  label={t('channel.edit.knowledge_id')}
                  name='other'
                  placeholder={t('channel.edit.knowledge_id_placeholder')}
                  onChange={handleInputChange}
                  value={inputs.other}
                  autoComplete='new-password'
                />
              </Form.Field>
            )}
            {inputs.type === 17 && (
              <Form.Field>
                <Form.Input
                  label={t('channel.edit.plugin_param')}
                  name='other'
                  placeholder={t('channel.edit.plugin_param_placeholder')}
                  onChange={handleInputChange}
                  value={inputs.other}
                  autoComplete='new-password'
                />
              </Form.Field>
            )}
            {inputs.type === 34 && (
              <Message>{t('channel.edit.coze_notice')}</Message>
            )}
            {inputs.type === 40 && (
              <Message>
                {t('channel.edit.douban_notice')}
                <a
                  target='_blank'
                  href='https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint'
                >
                  {t('channel.edit.douban_notice_link')}
                </a>
                {t('channel.edit.douban_notice_2')}
              </Message>
            )}
            {inputs.type !== 43 && (
              <Form.Field>
                <Form.Dropdown
                  label={t('channel.edit.models')}
                  placeholder={t('channel.edit.models_placeholder')}
                  name='models'
                  required
                  fluid
                  multiple
                  search
                  onLabelClick={(e, { value }) => {
                    copy(value).then();
                  }}
                  selection
                  onChange={handleInputChange}
                  value={inputs.models}
                  autoComplete='new-password'
                  options={modelOptions}
                />
              </Form.Field>
            )}
            {inputs.type !== 43 && (
              <div style={{ lineHeight: '40px', marginBottom: '12px' }}>
                <Button
                  type={'button'}
                  onClick={() => {
                    handleInputChange(null, {
                      name: 'models',
                      value: basicModels,
                    });
                  }}
                >
                  {t('channel.edit.buttons.fill_models')}
                </Button>
                <Button
                  type={'button'}
                  onClick={() => {
                    handleInputChange(null, {
                      name: 'models',
                      value: fullModels,
                    });
                  }}
                >
                  {t('channel.edit.buttons.fill_all')}
                </Button>
                <Button
                  type={'button'}
                  onClick={() => {
                    handleInputChange(null, { name: 'models', value: [] });
                  }}
                >
                  {t('channel.edit.buttons.clear')}
                </Button>
                <Input
                  action={
                    <Button type={'button'} onClick={addCustomModel}>
                      {t('channel.edit.buttons.add_custom')}
                    </Button>
                  }
                  placeholder={t('channel.edit.buttons.custom_placeholder')}
                  value={customModel}
                  onChange={(e, { value }) => {
                    setCustomModel(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addCustomModel();
                      e.preventDefault();
                    }
                  }}
                />
              </div>
            )}
            {inputs.type !== 43 && (
              <>
                <Form.Field>
                  <Form.TextArea
                    label={t('channel.edit.model_mapping')}
                    placeholder={`${t(
                      'channel.edit.model_mapping_placeholder'
                    )}\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`}
                    name='model_mapping'
                    onChange={handleInputChange}
                    value={inputs.model_mapping}
                    style={{
                      minHeight: 150,
                      fontFamily: 'JetBrains Mono, Consolas',
                    }}
                    autoComplete='new-password'
                  />
                </Form.Field>
                <Form.Field>
                  <Form.TextArea
                    label={t('channel.edit.system_prompt')}
                    placeholder={t('channel.edit.system_prompt_placeholder')}
                    name='system_prompt'
                    onChange={handleInputChange}
                    value={inputs.system_prompt}
                    style={{
                      minHeight: 150,
                      fontFamily: 'JetBrains Mono, Consolas',
                    }}
                    autoComplete='new-password'
                  />
                </Form.Field>
              </>
            )}
            {inputs.type === 33 && (
              <Form.Field>
                <Form.Input
                  label='Region'
                  name='region'
                  required
                  placeholder={t('channel.edit.aws_region_placeholder')}
                  onChange={handleConfigChange}
                  value={config.region}
                  autoComplete=''
                />
                <Form.Input
                  label='AK'
                  name='ak'
                  required
                  placeholder={t('channel.edit.aws_ak_placeholder')}
                  onChange={handleConfigChange}
                  value={config.ak}
                  autoComplete=''
                />
                <Form.Input
                  label='SK'
                  name='sk'
                  required
                  placeholder={t('channel.edit.aws_sk_placeholder')}
                  onChange={handleConfigChange}
                  value={config.sk}
                  autoComplete=''
                />
              </Form.Field>
            )}
            {inputs.type === 42 && (
              <Form.Field>
                <Form.Input
                  label='Region'
                  name='region'
                  required
                  placeholder={t('channel.edit.vertex_region_placeholder')}
                  onChange={handleConfigChange}
                  value={config.region}
                  autoComplete=''
                />
                <Form.Input
                  label={t('channel.edit.vertex_project_id')}
                  name='vertex_ai_project_id'
                  required
                  placeholder={t('channel.edit.vertex_project_id_placeholder')}
                  onChange={handleConfigChange}
                  value={config.vertex_ai_project_id}
                  autoComplete=''
                />
                <Form.Input
                  label={t('channel.edit.vertex_credentials')}
                  name='vertex_ai_adc'
                  required
                  placeholder={t('channel.edit.vertex_credentials_placeholder')}
                  onChange={handleConfigChange}
                  value={config.vertex_ai_adc}
                  autoComplete=''
                />
              </Form.Field>
            )}
            {inputs.type === 34 && (
              <Form.Input
                label={t('channel.edit.user_id')}
                name='user_id'
                required
                placeholder={t('channel.edit.user_id_placeholder')}
                onChange={handleConfigChange}
                value={config.user_id}
                autoComplete=''
              />
            )}
            {inputs.type !== 33 &&
              inputs.type !== 42 &&
              (batch ? (
                <Form.Field>
                  <Form.TextArea
                    label={t('channel.edit.key')}
                    name='key'
                    required
                    placeholder={t('channel.edit.batch_placeholder')}
                    onChange={handleInputChange}
                    value={inputs.key}
                    style={{
                      minHeight: 150,
                      fontFamily: 'JetBrains Mono, Consolas',
                    }}
                    autoComplete='new-password'
                  />
                </Form.Field>
              ) : (
                <Form.Field>
                  <Form.Input
                    label={t('channel.edit.key')}
                    name='key'
                    required
                    placeholder={type2secretPrompt(inputs.type, t)}
                    onChange={handleInputChange}
                    value={inputs.key}
                    autoComplete='new-password'
                  />
                </Form.Field>
              ))}
            {inputs.type === 37 && (
              <Form.Field>
                <Form.Input
                  label='Account ID'
                  name='user_id'
                  required
                  placeholder={
                    '请输入 Account ID，例如：d8d7c61dbc334c32d3ced580e4bf42b4'
                  }
                  onChange={handleConfigChange}
                  value={config.user_id}
                  autoComplete=''
                />
              </Form.Field>
            )}
            {inputs.type !== 33 && !isEdit && (
              <Form.Checkbox
                checked={batch}
                label={t('channel.edit.batch')}
                name='batch'
                onChange={() => setBatch(!batch)}
              />
            )}
            {inputs.type !== 3 &&
              inputs.type !== 33 &&
              inputs.type !== 8 &&
                inputs.type !== 50 &&
              inputs.type !== 22 && (
                <Form.Field>
                  <Form.Input
                      label={t('channel.edit.proxy_url')}
                    name='base_url'
                      placeholder={t('channel.edit.proxy_url_placeholder')}
                    onChange={handleInputChange}
                    value={inputs.base_url}
                    autoComplete='new-password'
                  />
                </Form.Field>
              )}
            {inputs.type === 22 && (
              <Form.Field>
                <Form.Input
                  label='私有部署地址'
                  name='base_url'
                  placeholder={
                    '请输入私有部署地址，格式为：https://fastgpt.run/api/openapi'
                  }
                  onChange={handleInputChange}
                  value={inputs.base_url}
                  autoComplete='new-password'
                />
              </Form.Field>
            )}
            <Button onClick={handleCancel}>
              {t('channel.edit.buttons.cancel')}
            </Button>
            <Button
              type={isEdit ? 'button' : 'submit'}
              positive
              onClick={submit}
            >
              {t('channel.edit.buttons.submit')}
            </Button>
          </Form>
          {isEdit && (
            <React.Fragment>
              <Divider />
              <Header as='h3'>
                {t('channel.edit.keys.title')}
                <Header.Subheader>
                  {t('channel.edit.keys.subtitle')}
                </Header.Subheader>
              </Header>
              {health && (
                <Message size='small'>
                  <Message.Header>
                    {t('channel.edit.keys.health_title')}
                  </Message.Header>
                  <p>
                    {t('channel.edit.keys.health_score')}:{' '}
                    <b>{health.health_score ?? '-'}</b>
                    {'　'}
                    {t('channel.edit.keys.circuit_state')}:{' '}
                    <b>{health.circuit?.state ?? '-'}</b>
                    {'　'}
                    {t('channel.edit.keys.key_count')}:{' '}
                    <b>{health.key_count ?? '-'}</b>
                    {'　'}
                    {t('channel.edit.keys.last_probe')}:{' '}
                    <b>{formatTime(health.last_probe_at)}</b>
                  </p>
                </Message>
              )}
              <div style={{ marginBottom: '10px' }}>
                <Button primary size='small' onClick={openAddKey}>
                  <Icon name='plus' />
                  {t('channel.edit.keys.buttons.add')}
                </Button>
                <Button
                  size='small'
                  onClick={recoverKeys}
                  disabled={
                    !keys.some((k) => k.status === 3)
                  }
                >
                  <Icon name='refresh' />
                  {t('channel.edit.keys.buttons.recover')}
                </Button>
              </div>
              <Table basic='very' compact>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>ID</Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.name')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.key_hint')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.weight')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.status')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.fail_count')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.last_used')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('channel.edit.keys.actions')}
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {keys.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={8} textAlign='center'>
                        {t('channel.edit.keys.empty')}
                      </Table.Cell>
                    </Table.Row>
                  )}
                  {keys.map((k) => (
                    <Table.Row key={k.id}>
                      <Table.Cell>{k.id}</Table.Cell>
                      <Table.Cell>{k.name || '-'}</Table.Cell>
                      <Table.Cell>{k.key_hint}</Table.Cell>
                      <Table.Cell>{k.weight || 1}</Table.Cell>
                      <Table.Cell>{keyStatusText(k.status)}</Table.Cell>
                      <Table.Cell>{k.fail_count}</Table.Cell>
                      <Table.Cell>{formatTime(k.last_used_at)}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size='mini'
                          icon='edit'
                          onClick={() => openEditKey(k)}
                        />
                        <Button
                          size='mini'
                          icon='trash'
                          color='red'
                          onClick={() => setDeleteKeyId(k.id)}
                        />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
              <Modal
                open={keyModal}
                onClose={() => setKeyModal(false)}
                size='tiny'
                closeOnDimmerClick={false}
              >
                <Modal.Header>
                  {editingKeyId > 0
                    ? t('channel.edit.keys.buttons.edit')
                    : t('channel.edit.keys.buttons.add')}
                </Modal.Header>
                <Modal.Content>
                  <Form>
                    {editingKeyId === 0 && (
                      <Form.Input
                        label={t('channel.edit.key')}
                        name='key'
                        value={keyForm.key}
                        onChange={(e, { value }) =>
                          setKeyForm((f) => ({ ...f, key: value }))
                        }
                        autoComplete='new-password'
                      />
                    )}
                    <Form.Input
                      label={t('channel.edit.keys.name')}
                      name='name'
                      value={keyForm.name}
                      onChange={(e, { value }) =>
                        setKeyForm((f) => ({ ...f, name: value }))
                      }
                    />
                    <Form.Input
                      label={t('channel.edit.keys.weight')}
                      name='weight'
                      type='number'
                      min='1'
                      value={keyForm.weight}
                      onChange={(e, { value }) =>
                        setKeyForm((f) => ({ ...f, weight: parseInt(value) }))
                      }
                    />
                  </Form>
                </Modal.Content>
                <Modal.Actions>
                  <Button onClick={() => setKeyModal(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button primary onClick={saveKey}>
                    {t('common.save')}
                  </Button>
                </Modal.Actions>
              </Modal>
              <Modal
                open={deleteKeyId > 0}
                onClose={() => setDeleteKeyId(0)}
                size='tiny'
              >
                <Modal.Header>{t('common.confirm')}</Modal.Header>
                <Modal.Content>
                  <p>{t('common.delete_confirm_message')}</p>
                </Modal.Content>
                <Modal.Actions>
                  <Button onClick={() => setDeleteKeyId(0)}>
                    {t('common.cancel')}
                  </Button>
                  <Button color='red' onClick={confirmDeleteKey}>
                    {t('common.delete')}
                  </Button>
                </Modal.Actions>
              </Modal>
            </React.Fragment>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default EditChannel;
