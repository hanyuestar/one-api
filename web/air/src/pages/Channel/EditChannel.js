import React, {useEffect, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {API, isMobile, showError, showInfo, showSuccess, verifyJSON} from '../../helpers';
import {CHANNEL_OPTIONS} from '../../constants';
import Title from "@douyinfe/semi-ui/lib/es/typography/title";
import {SideSheet, Space, Spin, Button, Input, Typography, Select, TextArea, Checkbox, Banner, Table, Modal, Divider, Toast} from "@douyinfe/semi-ui";

const MODEL_MAPPING_EXAMPLE = {
    'gpt-3.5-turbo-0301': 'gpt-3.5-turbo',
    'gpt-4-0314': 'gpt-4',
    'gpt-4-32k-0314': 'gpt-4-32k'
};

function type2secretPrompt(type) {
    // inputs.type === 15 ? '按照如下格式输入：APIKey|SecretKey' : (inputs.type === 18 ? '按照如下格式输入：APPID|APISecret|APIKey' : '请输入渠道对应的鉴权密钥')
    switch (type) {
        case 15:
            return '按照如下格式输入：APIKey|SecretKey';
        case 18:
            return '按照如下格式输入：APPID|APISecret|APIKey';
        case 22:
            return '按照如下格式输入：APIKey-AppId，例如：fastgpt-0sp2gtvfdgyi4k30jwlgwf1i-64f335d84283f05518e9e041';
        case 23:
            return '按照如下格式输入：AppId|SecretId|SecretKey';
        default:
            return '请输入渠道对应的鉴权密钥';
    }
}

const EditChannel = (props) => {
    const navigate = useNavigate();
    const channelId = props.editingChannel.id;
    const isEdit = channelId !== undefined;
    const [loading, setLoading] = useState(isEdit);
    const handleCancel = () => {
        props.handleClose()
    };
    const originInputs = {
        name: '',
        type: 1,
        key: '',
        openai_organization: '',
        base_url: '',
        other: '',
        model_mapping: '',
        system_prompt: '',
        models: [],
        auto_ban: 1,
        groups: ['default']
    };
    const [batch, setBatch] = useState(false);
    const [autoBan, setAutoBan] = useState(true);
    // const [autoBan, setAutoBan] = useState(true);
    const [inputs, setInputs] = useState(originInputs);
    const [originModelOptions, setOriginModelOptions] = useState([]);
    const [modelOptions, setModelOptions] = useState([]);
    const [groupOptions, setGroupOptions] = useState([]);
    const [basicModels, setBasicModels] = useState([]);
    const [fullModels, setFullModels] = useState([]);
    const [customModel, setCustomModel] = useState('');
    const handleInputChange = (name, value) => {
        setInputs((inputs) => ({...inputs, [name]: value}));
        if (name === 'type' && inputs.models.length === 0) {
            let localModels = [];
            switch (value) {
                case 14:
                    localModels = ["claude-instant-1.2", "claude-2", "claude-2.0", "claude-2.1", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20240620", "claude-3-5-sonnet-20241022"];
                    break;
                case 11:
                    localModels = ['PaLM-2'];
                    break;
                case 15:
                    localModels = ['ERNIE-Bot', 'ERNIE-Bot-turbo', 'ERNIE-Bot-4', 'Embedding-V1'];
                    break;
                case 17:
                    localModels = ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-max-longcontext", 'text-embedding-v1'];
                    break;
                case 16:
                    localModels = ['chatglm_pro', 'chatglm_std', 'chatglm_lite'];
                    break;
                case 18:
                    localModels = ['SparkDesk', 'SparkDesk-v1.1', 'SparkDesk-v2.1', 'SparkDesk-v3.1', 'SparkDesk-v3.1-128K', 'SparkDesk-v3.5', 'SparkDesk-v3.5-32K', 'SparkDesk-v4.0'];
                    break;
                case 19:
                    localModels = ['360GPT_S2_V9', 'embedding-bert-512-v1', 'embedding_s1_v1', 'semantic_similarity_s1_v1'];
                    break;
                case 23:
                    localModels = ['hunyuan'];
                    break;
                case 24:
                    localModels = ['gemini-pro', 'gemini-pro-vision'];
                    break;
                case 25:
                    localModels = ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'];
                    break;
                case 26:
                    localModels = ['glm-4', 'glm-4v', 'glm-3-turbo'];
                    break;
                case 2:
                    localModels = ['mj_imagine', 'mj_variation', 'mj_reroll', 'mj_blend', 'mj_upscale', 'mj_describe'];
                    break;
                case 5:
                    localModels = [
                        'swap_face',
                        'mj_imagine',
                        'mj_variation',
                        'mj_reroll',
                        'mj_blend',
                        'mj_upscale',
                        'mj_describe',
                        'mj_zoom',
                        'mj_shorten',
                        'mj_modal',
                        'mj_inpaint',
                        'mj_custom_zoom',
                        'mj_high_variation',
                        'mj_low_variation',
                        'mj_pan',
                    ];
                    break;
            }
            setInputs((inputs) => ({...inputs, models: localModels}));
        }
        //setAutoBan
    };


    const loadChannel = async () => {
        setLoading(true)
        let res = await API.get(`/api/channel/${channelId}`);
        const {success, message, data} = res.data;
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
                data.model_mapping = JSON.stringify(JSON.parse(data.model_mapping), null, 2);
            }
            setInputs(data);
            if (data.auto_ban === 0) {
                setAutoBan(false);
            } else {
                setAutoBan(true);
            }
            // console.log(data);
        } else {
            showError(message);
        }
        setLoading(false);
    };

    const fetchModels = async () => {
        try {
            let res = await API.get(`/api/channel/models`);
            let localModelOptions = res.data.data.map((model) => ({
                label: model.id,
                value: model.id
            }));
            setOriginModelOptions(localModelOptions);
            setFullModels(res.data.data.map((model) => model.id));
            setBasicModels(res.data.data.filter((model) => {
                return model.id.startsWith('gpt-3') || model.id.startsWith('text-');
            }).map((model) => model.id));
        } catch (error) {
            showError(error.message);
        }
    };

    const fetchGroups = async () => {
        try {
            let res = await API.get(`/api/group/`);
            setGroupOptions(res.data.data.map((group) => ({
                label: group,
                value: group
            })));
        } catch (error) {
            showError(error.message);
        }
    };

    useEffect(() => {
        let localModelOptions = [...originModelOptions];
        inputs.models.forEach((model) => {
            if (!localModelOptions.find((option) => option.key === model)) {
                localModelOptions.push({
                    label: model,
                    value: model
                });
            }
        });
        setModelOptions(localModelOptions);
    }, [originModelOptions, inputs.models]);

    useEffect(() => {
        fetchModels().then();
        fetchGroups().then();
        if (isEdit) {
            loadChannel().then(
                () => {

                }
            );
            loadKeys().then();
            loadHealth().then();
        } else {
            setInputs(originInputs)
        }
    }, [props.editingChannel.id]);


    const submit = async () => {
        if (!isEdit && (inputs.name === '' || inputs.key === '')) {
            showInfo('请填写渠道名称和渠道密钥！');
            return;
        }
        if (inputs.models.length === 0) {
            showInfo('请至少选择一个模型！');
            return;
        }
        if (inputs.model_mapping !== '' && !verifyJSON(inputs.model_mapping)) {
            showInfo('模型映射必须是合法的 JSON 格式！');
            return;
        }
        let localInputs = {...inputs};
        if (localInputs.base_url && localInputs.base_url.endsWith('/')) {
            localInputs.base_url = localInputs.base_url.slice(0, localInputs.base_url.length - 1);
        }
        if (localInputs.type === 3 && localInputs.other === '') {
            localInputs.other = '2024-03-01-preview';
        }
        if (localInputs.type === 18 && localInputs.other === '') {
            localInputs.other = 'v2.1';
        }
        let res;
        if (!Array.isArray(localInputs.models)) {
            showError('提交失败，请勿重复提交！');
            handleCancel();
            return;
        }
        localInputs.auto_ban = autoBan ? 1 : 0;
        localInputs.models = localInputs.models.join(',');
        localInputs.group = localInputs.groups.join(',');
        if (isEdit) {
            res = await API.put(`/api/channel/`, {...localInputs, id: parseInt(channelId)});
        } else {
            res = await API.post(`/api/channel/`, localInputs);
        }
        const {success, message} = res.data;
        if (success) {
            if (isEdit) {
                showSuccess('渠道更新成功！');
            } else {
                showSuccess('渠道创建成功！');
                setInputs(originInputs);
            }
            props.refresh();
            props.handleClose();
        } else {
            showError(message);
        }
    };

    const addCustomModel = () => {
        if (customModel.trim() === '') return;
        if (inputs.models.includes(customModel)) return showError("该模型已存在！");
        let localModels = [...inputs.models];
        localModels.push(customModel);
        let localModelOptions = [];
        localModelOptions.push({
            key: customModel,
            text: customModel,
            value: customModel
        });
        setModelOptions(modelOptions => {
            return [...modelOptions, ...localModelOptions];
        });
        setCustomModel('');
        handleInputChange('models', localModels);
    };

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
            showInfo('Key 不能为空');
            return;
        }
        if (editingKeyId === 0) {
            const res = await API.post(`/api/channel/${channelId}/keys`, keyForm);
            if (res.data.success) {
                Toast.success('操作成功');
                setKeyModal(false);
                loadKeys().then();
            } else {
                showError(res.data.message);
            }
        } else {
            const res = await API.put(`/api/channel/keys/${editingKeyId}`, {
                name: keyForm.name,
                weight: keyForm.weight,
            });
            if (res.data.success) {
                Toast.success('操作成功');
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
            Toast.success('操作成功');
            setDeleteKeyId(0);
            loadKeys().then();
        } else {
            showError(res.data.message);
        }
    };

    const recoverKeys = async () => {
        const res = await API.post(`/api/channel/${channelId}/keys/recover`);
        if (res.data.success) {
            Toast.success('操作成功');
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
        <>
            <SideSheet
                maskClosable={false}
                placement={isEdit ? 'right' : 'left'}
                title={<Title level={3}>{isEdit ? '更新渠道信息' : '创建新的渠道'}</Title>}
                headerStyle={{borderBottom: '1px solid var(--semi-color-border)'}}
                bodyStyle={{borderBottom: '1px solid var(--semi-color-border)'}}
                visible={props.visible}
                footer={
                    <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                        <Space>
                            <Button theme='solid' size={'large'} onClick={submit}>提交</Button>
                            <Button theme='solid' size={'large'} type={'tertiary'} onClick={handleCancel}>取消</Button>
                        </Space>
                    </div>
                }
                closeIcon={null}
                onCancel={() => handleCancel()}
                width={isMobile() ? '100%' : 600}
            >
                <Spin spinning={loading}>
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>类型：</Typography.Text>
                    </div>
                    <Select
                      name='type'
                      required
                      optionList={CHANNEL_OPTIONS}
                      value={inputs.type}
                      onChange={value => handleInputChange('type', value)}
                      style={{ width: '50%' }}
                    />
                    {
                      inputs.type === 3 && (
                        <>
                            <div style={{ marginTop: 10 }}>
                                <Banner type={"warning"} description={
                                    <>
                                        注意，<strong>模型部署名称必须和模型名称保持一致</strong>，因为 One API 会把请求体中的
                                        model
                                        参数替换为你的部署名称（模型名称中的点会被剔除），<a target='_blank'
                                                                                          href='https://github.com/hanyuestar/one-api/issues/133?notification_referrer_id=NT_kwDOAmJSYrM2NjIwMzI3NDgyOjM5OTk4MDUw#issuecomment-1571602271'>图片演示</a>。
                                    </>
                                }>
                                </Banner>
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>AZURE_OPENAI_ENDPOINT：</Typography.Text>
                            </div>
                            <Input
                              label='AZURE_OPENAI_ENDPOINT'
                              name='azure_base_url'
                              placeholder={'请输入 AZURE_OPENAI_ENDPOINT，例如：https://docs-test-001.openai.azure.com'}
                              onChange={value => {
                                  handleInputChange('base_url', value)
                              }}
                              value={inputs.base_url}
                              autoComplete='new-password'
                            />
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>默认 API 版本：</Typography.Text>
                            </div>
                            <Input
                              label='默认 API 版本'
                              name='azure_other'
                              placeholder={'请输入默认 API 版本，例如：2024-03-01-preview，该配置可以被实际的请求查询参数所覆盖'}
                              onChange={value => {
                                  handleInputChange('other', value)
                              }}
                              value={inputs.other}
                              autoComplete='new-password'
                            />
                        </>
                      )
                    }
                    {
                      inputs.type === 8 && (
                        <>
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>Base URL：</Typography.Text>
                            </div>
                            <Input
                              name='base_url'
                              placeholder={'请输入自定义渠道的 Base URL'}
                              onChange={value => {
                                  handleInputChange('base_url', value)
                              }}
                              value={inputs.base_url}
                              autoComplete='new-password'
                            />
                        </>
                      )
                    }
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>名称：</Typography.Text>
                    </div>
                    <Input
                      required
                      name='name'
                      placeholder={'请为渠道命名'}
                      onChange={value => {
                          handleInputChange('name', value)
                      }}
                      value={inputs.name}
                      autoComplete='new-password'
                    />
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>分组：</Typography.Text>
                    </div>
                    <Select
                      placeholder={'请选择可以使用该渠道的分组'}
                      name='groups'
                      required
                      multiple
                      selection
                      allowAdditions
                      additionLabel={'请在系统设置页面编辑分组倍率以添加新的分组：'}
                      onChange={value => {
                          handleInputChange('groups', value)
                      }}
                      value={inputs.groups}
                      autoComplete='new-password'
                      optionList={groupOptions}
                    />
                    {
                      inputs.type === 18 && (
                        <>
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>模型版本：</Typography.Text>
                            </div>
                            <Input
                              name='other'
                              placeholder={'请输入星火大模型版本，注意是接口地址中的版本号，例如：v2.1'}
                              onChange={value => {
                                  handleInputChange('other', value)
                              }}
                              value={inputs.other}
                              autoComplete='new-password'
                            />
                        </>
                      )
                    }
                    {
                      inputs.type === 21 && (
                        <>
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>知识库 ID：</Typography.Text>
                            </div>
                            <Input
                              label='知识库 ID'
                              name='other'
                              placeholder={'请输入知识库 ID，例如：123456'}
                              onChange={value => {
                                  handleInputChange('other', value)
                              }}
                              value={inputs.other}
                              autoComplete='new-password'
                            />
                        </>
                      )
                    }
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>模型：</Typography.Text>
                    </div>
                    <Select
                      placeholder={'请选择该渠道所支持的模型'}
                      name='models'
                      required
                      multiple
                      selection
                      onChange={value => {
                          handleInputChange('models', value)
                      }}
                      value={inputs.models}
                      autoComplete='new-password'
                      optionList={modelOptions}
                    />
                    <div style={{ lineHeight: '40px', marginBottom: '12px' }}>
                        <Space>
                            <Button type='primary' onClick={() => {
                                handleInputChange('models', basicModels);
                            }}>填入基础模型</Button>
                            <Button type='secondary' onClick={() => {
                                handleInputChange('models', fullModels);
                            }}>填入所有模型</Button>
                            <Button type='warning' onClick={() => {
                                handleInputChange('models', []);
                            }}>清除所有模型</Button>
                        </Space>
                        <Input
                          addonAfter={
                              <Button type='primary' onClick={addCustomModel}>填入</Button>
                          }
                          placeholder='输入自定义模型名称'
                          value={customModel}
                          onChange={(value) => {
                              setCustomModel(value.trim());
                          }}
                        />
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>模型重定向：</Typography.Text>
                    </div>
                    <TextArea
                      placeholder={`此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，例如：\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`}
                      name='model_mapping'
                      onChange={value => {
                          handleInputChange('model_mapping', value)
                      }}
                      autosize
                      value={inputs.model_mapping}
                      autoComplete='new-password'
                    />
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>系统提示词：</Typography.Text>
                    </div>
                    <TextArea
                      placeholder={`此项可选，用于强制设置给定的系统提示词，请配合自定义模型 & 模型重定向使用，首先创建一个唯一的自定义模型名称并在上面填入，之后将该自定义模型重定向映射到该渠道一个原生支持的模型`}
                      name='system_prompt'
                      onChange={value => {
                          handleInputChange('system_prompt', value)
                      }}
                      autosize
                      value={inputs.system_prompt}
                      autoComplete='new-password'
                    />
                    <Typography.Text style={{
                        color: 'rgba(var(--semi-blue-5), 1)',
                        userSelect: 'none',
                        cursor: 'pointer'
                    }} onClick={
                        () => {
                            handleInputChange('model_mapping', JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2))
                        }
                    }>
                        填入模板
                    </Typography.Text>
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>密钥：</Typography.Text>
                    </div>
                    {
                        batch ?
                          <TextArea
                            label='密钥'
                            name='key'
                            required
                            placeholder={'请输入密钥，一行一个'}
                            onChange={value => {
                                handleInputChange('key', value)
                            }}
                            value={inputs.key}
                            style={{ minHeight: 150, fontFamily: 'JetBrains Mono, Consolas' }}
                            autoComplete='new-password'
                          />
                          :
                          <Input
                            label='密钥'
                            name='key'
                            required
                            placeholder={type2secretPrompt(inputs.type)}
                            onChange={value => {
                                handleInputChange('key', value)
                            }}
                            value={inputs.key}
                            autoComplete='new-password'
                          />
                    }
                    <div style={{ marginTop: 10 }}>
                        <Typography.Text strong>组织：</Typography.Text>
                    </div>
                    <Input
                      label='组织，可选，不填则为默认组织'
                      name='openai_organization'
                      placeholder='请输入组织org-xxx'
                      onChange={value => {
                          handleInputChange('openai_organization', value)
                      }}
                      value={inputs.openai_organization}
                    />
                    <div style={{ marginTop: 10, display: 'flex' }}>
                        <Space>
                            <Checkbox
                              name='auto_ban'
                              checked={autoBan}
                              onChange={
                                  () => {
                                      setAutoBan(!autoBan);
                                  }
                              }
                              // onChange={handleInputChange}
                            />
                            <Typography.Text
                              strong>是否自动禁用（仅当自动禁用开启时有效），关闭后不会自动禁用该渠道：</Typography.Text>
                        </Space>
                    </div>

                    {
                      !isEdit && (
                        <div style={{ marginTop: 10, display: 'flex' }}>
                            <Space>
                                <Checkbox
                                  checked={batch}
                                  label='批量创建'
                                  name='batch'
                                  onChange={() => setBatch(!batch)}
                                />
                                <Typography.Text strong>批量创建</Typography.Text>
                            </Space>
                        </div>
                      )
                    }
                    {
                      inputs.type !== 3 && inputs.type !== 8 && inputs.type !== 22 && (
                        <>
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>代理：</Typography.Text>
                            </div>
                            <Input
                              label='代理'
                              name='base_url'
                              placeholder={'此项可选，用于通过代理站来进行 API 调用'}
                              onChange={value => {
                                  handleInputChange('base_url', value)
                              }}
                              value={inputs.base_url}
                              autoComplete='new-password'
                            />
                        </>
                      )
                    }
                    {
                      inputs.type === 22 && (
                        <>
                            <div style={{ marginTop: 10 }}>
                                <Typography.Text strong>私有部署地址：</Typography.Text>
                            </div>
                            <Input
                              name='base_url'
                              placeholder={'请输入私有部署地址，格式为：https://fastgpt.run/api/openapi'}
                              onChange={value => {
                                  handleInputChange('base_url', value)
                              }}
                              value={inputs.base_url}
                              autoComplete='new-password'
                            />
                        </>
                      )
                    }
                    {isEdit && (
                        <React.Fragment>
                            <Divider margin='24px' />
                            <Typography.Title heading={4} style={{ marginBottom: 0 }}>
                                渠道 Key 管理
                            </Typography.Title>
                            <Typography.Text type='tertiary' size='small'>
                                为渠道配置多个上游 Key 实现负载均衡；Key 加密存储，仅展示脱敏后缀
                            </Typography.Text>
                            {health && (
                                <Banner
                                    type='info'
                                    style={{ margin: '12px 0' }}
                                    description={
                                        <>
                                            渠道健康状态：健康分 <b>{health.health_score ?? '-'}</b>　
                                            熔断状态 <b>{health.circuit?.state ?? '-'}</b>　
                                            Key 数量 <b>{health.key_count ?? '-'}</b>　
                                            最近探测 <b>{formatTime(health.last_probe_at)}</b>
                                        </>
                                    }
                                />
                            )}
                            <div style={{ margin: '12px 0' }}>
                                <Space>
                                    <Button theme='solid' type='primary' size='small' onClick={openAddKey}>
                                        添加 Key
                                    </Button>
                                    <Button
                                        size='small'
                                        onClick={recoverKeys}
                                        disabled={!keys.some((k) => k.status === 3)}
                                    >
                                        恢复隔离 Key
                                    </Button>
                                </Space>
                            </div>
                            <Table
                                dataSource={keys}
                                rowKey='id'
                                pagination={false}
                                empty={<Typography.Text type='tertiary'>尚未配置多 Key，当前使用渠道主 Key</Typography.Text>}
                                columns={[
                                    { title: 'ID', dataIndex: 'id', width: 50 },
                                    { title: '名称', dataIndex: 'name', render: (t) => t || '-' },
                                    { title: 'Key', dataIndex: 'key_hint' },
                                    { title: '权重', dataIndex: 'weight', width: 60, render: (t) => t || 1 },
                                    { title: '状态', dataIndex: 'status', width: 80, render: (t) => keyStatusText(t) },
                                    { title: '失败次数', dataIndex: 'fail_count', width: 80 },
                                    { title: '最近使用', dataIndex: 'last_used_at', width: 130, render: (t) => formatTime(t) },
                                    {
                                        title: '操作',
                                        dataIndex: 'ops',
                                        width: 120,
                                        render: (_, k) => (
                                            <Space>
                                                <Button size='small' theme='borderless' type='primary' onClick={() => openEditKey(k)}>编辑</Button>
                                                <Button size='small' theme='borderless' type='danger' onClick={() => setDeleteKeyId(k.id)}>删除</Button>
                                            </Space>
                                        ),
                                    },
                                ]}
                            />
                            <Modal
                                title={editingKeyId > 0 ? '编辑 Key' : '添加 Key'}
                                visible={keyModal}
                                onCancel={() => setKeyModal(false)}
                                footer={
                                    <>
                                        <Button onClick={() => setKeyModal(false)}>取消</Button>
                                        <Button theme='solid' type='primary' onClick={saveKey}>保存</Button>
                                    </>
                                }
                            >
                                {editingKeyId === 0 && (
                                    <Input
                                        label='Key'
                                        value={keyForm.key}
                                        placeholder='请输入上游 API Key'
                                        onChange={(v) => setKeyForm((f) => ({ ...f, key: v }))}
                                        style={{ marginBottom: 16 }}
                                        autoComplete='new-password'
                                    />
                                )}
                                <Input
                                    label='名称'
                                    value={keyForm.name}
                                    placeholder='可选，用于标识'
                                    onChange={(v) => setKeyForm((f) => ({ ...f, name: v }))}
                                    style={{ marginBottom: 16 }}
                                />
                                <Input
                                    label='权重'
                                    type='number'
                                    min={1}
                                    value={keyForm.weight}
                                    onChange={(v) => setKeyForm((f) => ({ ...f, weight: parseInt(v) }))}
                                />
                            </Modal>
                            <Modal
                                title='确认'
                                visible={deleteKeyId > 0}
                                onCancel={() => setDeleteKeyId(0)}
                                footer={
                                    <>
                                        <Button onClick={() => setDeleteKeyId(0)}>取消</Button>
                                        <Button type='danger' theme='solid' onClick={confirmDeleteKey}>删除</Button>
                                    </>
                                }
                            >
                                <Typography.Text>确定要删除该项吗？</Typography.Text>
                            </Modal>
                        </React.Fragment>
                    )}

                </Spin>
            </SideSheet>
        </>
    );
};

export default EditChannel;
