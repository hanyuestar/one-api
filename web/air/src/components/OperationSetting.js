import React, { useEffect, useState } from 'react';
import { Form } from 'semantic-ui-react';
import { Divider, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess, timestamp2string, verifyJSON } from '../helpers';

const OperationSetting = () => {
  let now = new Date();
  let [inputs, setInputs] = useState({
    QuotaForNewUser: 0,
    QuotaForInviter: 0,
    QuotaForInvitee: 0,
    QuotaRemindThreshold: 0,
    PreConsumedQuota: 0,
    ModelRatio: '',
    CompletionRatio: '',
    GroupRatio: '',
    CacheHitRatio: '',
    CacheWriteRatio: '',
    TopUpLink: '',
    QuotaPerUnit: 0,
    AutomaticDisableChannelEnabled: '',
    AutomaticEnableChannelEnabled: '',
    ChannelDisableThreshold: 0,
    LogConsumeEnabled: '',
    DisplayInCurrencyEnabled: '',
    DisplayTokenStatEnabled: '',
    ApproximateTokenEnabled: '',
    RetryTimes: 0
  });
  const [originInputs, setOriginInputs] = useState({});
  let [loading, setLoading] = useState(false);
  let [historyTimestamp, setHistoryTimestamp] = useState(timestamp2string(now.getTime() / 1000 - 30 * 24 * 3600)); // a month ago

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key === 'ModelRatio' || item.key === 'GroupRatio' || item.key === 'CompletionRatio' || item.key === 'CacheHitRatio' || item.key === 'CacheWriteRatio') {
          item.value = JSON.stringify(JSON.parse(item.value), null, 2);
        }
        if (item.value === '{}') {
          item.value = '';
        }
        newInputs[item.key] = item.value;
      });
      setInputs(newInputs);
      setOriginInputs(newInputs);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions().then();
  }, []);

  const updateOption = async (key, value) => {
    setLoading(true);
    if (key.endsWith('Enabled')) {
      value = inputs[key] === 'true' ? 'false' : 'true';
    }
    const res = await API.put('/api/option/', {
      key,
      value
    });
    const { success, message } = res.data;
    if (success) {
      setInputs((inputs) => ({ ...inputs, [key]: value }));
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handleInputChange = async (e, { name, value }) => {
    if (name.endsWith('Enabled')) {
      await updateOption(name, value);
    } else {
      setInputs((inputs) => ({ ...inputs, [name]: value }));
    }
  };

  const submitConfig = async (group) => {
    switch (group) {
      case 'monitor':
        if (originInputs['ChannelDisableThreshold'] !== inputs.ChannelDisableThreshold) {
          await updateOption('ChannelDisableThreshold', inputs.ChannelDisableThreshold);
        }
        if (originInputs['QuotaRemindThreshold'] !== inputs.QuotaRemindThreshold) {
          await updateOption('QuotaRemindThreshold', inputs.QuotaRemindThreshold);
        }
        break;
      case 'ratio':
        if (originInputs['ModelRatio'] !== inputs.ModelRatio) {
          if (!verifyJSON(inputs.ModelRatio)) {
            showError('模型倍率不是合法的 JSON 字符串');
            return;
          }
          await updateOption('ModelRatio', inputs.ModelRatio);
        }
        if (originInputs['GroupRatio'] !== inputs.GroupRatio) {
          if (!verifyJSON(inputs.GroupRatio)) {
            showError('分组倍率不是合法的 JSON 字符串');
            return;
          }
          await updateOption('GroupRatio', inputs.GroupRatio);
        }
        if (originInputs['CompletionRatio'] !== inputs.CompletionRatio) {
          if (!verifyJSON(inputs.CompletionRatio)) {
            showError('补全倍率不是合法的 JSON 字符串');
            return;
          }
          await updateOption('CompletionRatio', inputs.CompletionRatio);
        }
        if (originInputs['CacheHitRatio'] !== inputs.CacheHitRatio) {
          if (!verifyJSON(inputs.CacheHitRatio)) {
            showError('缓存命中倍率不是合法的 JSON 字符串');
            return;
          }
          await updateOption('CacheHitRatio', inputs.CacheHitRatio);
        }
        if (originInputs['CacheWriteRatio'] !== inputs.CacheWriteRatio) {
          if (!verifyJSON(inputs.CacheWriteRatio)) {
            showError('缓存写入倍率不是合法的 JSON 字符串');
            return;
          }
          await updateOption('CacheWriteRatio', inputs.CacheWriteRatio);
        }
        break;
      case 'quota':
        if (originInputs['QuotaForNewUser'] !== inputs.QuotaForNewUser) {
          await updateOption('QuotaForNewUser', inputs.QuotaForNewUser);
        }
        if (originInputs['QuotaForInvitee'] !== inputs.QuotaForInvitee) {
          await updateOption('QuotaForInvitee', inputs.QuotaForInvitee);
        }
        if (originInputs['QuotaForInviter'] !== inputs.QuotaForInviter) {
          await updateOption('QuotaForInviter', inputs.QuotaForInviter);
        }
        if (originInputs['PreConsumedQuota'] !== inputs.PreConsumedQuota) {
          await updateOption('PreConsumedQuota', inputs.PreConsumedQuota);
        }
        break;
      case 'general':
        if (originInputs['TopUpLink'] !== inputs.TopUpLink) {
          await updateOption('TopUpLink', inputs.TopUpLink);
        }
        if (originInputs['QuotaPerUnit'] !== inputs.QuotaPerUnit) {
          await updateOption('QuotaPerUnit', inputs.QuotaPerUnit);
        }
        if (originInputs['RetryTimes'] !== inputs.RetryTimes) {
          await updateOption('RetryTimes', inputs.RetryTimes);
        }
        break;
    }
  };

  const deleteHistoryLogs = async () => {
    console.log(inputs);
    const res = await API.delete(`/api/log/?target_timestamp=${Date.parse(historyTimestamp) / 1000}`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(`${data} 条日志已清理！`);
      return;
    }
    showError('日志清理失败：' + message);
  };

  return (
    <div>
        <Form loading={loading}>
          <Typography.Title heading={4}>通用设置</Typography.Title>
          <Form.Group widths={4}>
            <Form.Input
              label='充值链接'
              name='TopUpLink'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.TopUpLink}
              type='link'
              placeholder='例如发卡网站的购买链接'
            />
            <Form.Input
              label='单位美元额度'
              name='QuotaPerUnit'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.QuotaPerUnit}
              type='number'
              step='0.01'
              placeholder='一单位货币能兑换的额度'
            />
            <Form.Input
              label='失败重试次数'
              name='RetryTimes'
              type={'number'}
              step='1'
              min='0'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.RetryTimes}
              placeholder='失败重试次数'
            />
          </Form.Group>
          <Form.Group inline>
            <Form.Checkbox
              checked={inputs.DisplayInCurrencyEnabled === 'true'}
              label='以货币形式显示额度'
              name='DisplayInCurrencyEnabled'
              onChange={handleInputChange}
            />
            <Form.Checkbox
              checked={inputs.DisplayTokenStatEnabled === 'true'}
              label='Billing 相关 API 显示令牌额度而非用户额度'
              name='DisplayTokenStatEnabled'
              onChange={handleInputChange}
            />
            <Form.Checkbox
              checked={inputs.ApproximateTokenEnabled === 'true'}
              label='使用近似的方式估算 token 数以减少计算量'
              name='ApproximateTokenEnabled'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Button onClick={() => {
            submitConfig('general').then();
          }}>保存通用设置</Form.Button>
          <Divider />
          <Typography.Title heading={4}>日志设置</Typography.Title>
          <Form.Group inline>
            <Form.Checkbox
              checked={inputs.LogConsumeEnabled === 'true'}
              label='启用额度消费日志记录'
              name='LogConsumeEnabled'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Group widths={4}>
            <Form.Input label='目标时间' value={historyTimestamp} type='datetime-local'
                        name='history_timestamp'
                        onChange={(e, { name, value }) => {
                          setHistoryTimestamp(value);
                        }} />
          </Form.Group>
          <Form.Button onClick={() => {
            deleteHistoryLogs().then();
          }}>清理历史日志</Form.Button>
          <Divider />
          <Typography.Title heading={4}>监控设置</Typography.Title>
          <Form.Group widths={3}>
            <Form.Input
              label='最长响应时间'
              name='ChannelDisableThreshold'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.ChannelDisableThreshold}
              type='number'
              min='0'
              placeholder='单位秒，当运行渠道全部测试时，超过此时间将自动禁用渠道'
            />
            <Form.Input
              label='额度提醒阈值'
              name='QuotaRemindThreshold'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.QuotaRemindThreshold}
              type='number'
              min='0'
              placeholder='低于此额度时将发送邮件提醒用户'
            />
          </Form.Group>
          <Form.Group inline>
            <Form.Checkbox
              checked={inputs.AutomaticDisableChannelEnabled === 'true'}
              label='失败时自动禁用渠道'
              name='AutomaticDisableChannelEnabled'
              onChange={handleInputChange}
            />
            <Form.Checkbox
              checked={inputs.AutomaticEnableChannelEnabled === 'true'}
              label='成功时自动启用渠道'
              name='AutomaticEnableChannelEnabled'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Button onClick={() => {
            submitConfig('monitor').then();
          }}>保存监控设置</Form.Button>
          <Divider />
          <Typography.Title heading={4}>额度设置</Typography.Title>
          <Form.Group widths={4}>
            <Form.Input
              label='新用户初始额度'
              name='QuotaForNewUser'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.QuotaForNewUser}
              type='number'
              min='0'
              placeholder='例如：100'
            />
            <Form.Input
              label='请求预扣费额度'
              name='PreConsumedQuota'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.PreConsumedQuota}
              type='number'
              min='0'
              placeholder='请求结束后多退少补'
            />
            <Form.Input
              label='邀请新用户奖励额度'
              name='QuotaForInviter'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.QuotaForInviter}
              type='number'
              min='0'
              placeholder='例如：2000'
            />
            <Form.Input
              label='新用户使用邀请码奖励额度'
              name='QuotaForInvitee'
              onChange={handleInputChange}
              autoComplete='new-password'
              value={inputs.QuotaForInvitee}
              type='number'
              min='0'
              placeholder='例如：1000'
            />
          </Form.Group>
          <Form.Button onClick={() => {
            submitConfig('quota').then();
          }}>保存额度设置</Form.Button>
          <Divider />
          <Typography.Title heading={4}>倍率设置</Typography.Title>
          <Form.Group widths='equal'>
            <Form.TextArea
              label='模型倍率'
              name='ModelRatio'
              onChange={handleInputChange}
              style={{ minHeight: 250, fontFamily: 'JetBrains Mono, Consolas' }}
              autoComplete='new-password'
              value={inputs.ModelRatio}
              placeholder='为一个 JSON 文本，键为模型名称，值为倍率'
            />
          </Form.Group>
          <Form.Group widths='equal'>
            <Form.TextArea
              label='补全倍率'
              name='CompletionRatio'
              onChange={handleInputChange}
              style={{ minHeight: 250, fontFamily: 'JetBrains Mono, Consolas' }}
              autoComplete='new-password'
              value={inputs.CompletionRatio}
              placeholder='为一个 JSON 文本，键为模型名称，值为倍率，此处的倍率设置是模型补全倍率相较于提示倍率的比例，使用该设置可强制覆盖 One API 的内部比例'
            />
          </Form.Group>
          <Form.Group widths='equal'>
            <Form.TextArea
              label='分组倍率'
              name='GroupRatio'
              onChange={handleInputChange}
              style={{ minHeight: 250, fontFamily: 'JetBrains Mono, Consolas' }}
              autoComplete='new-password'
              value={inputs.GroupRatio}
              placeholder='为一个 JSON 文本，键为分组名称，值为倍率'
            />
          </Form.Group>
          <Form.Group widths='equal'>
            <Form.TextArea
              label='缓存命中倍率'
              name='CacheHitRatio'
              onChange={handleInputChange}
              style={{ minHeight: 250, fontFamily: 'JetBrains Mono, Consolas' }}
              autoComplete='new-password'
              value={inputs.CacheHitRatio}
              placeholder='为一个 JSON 文本，键为模型名称，值为缓存命中（读缓存）输入 token 的折扣系数（如 0.5 表示打 5 折、0.1 表示打 1 折），未配置的模型默认按正常输入计费'
            />
          </Form.Group>
          <Form.Group widths='equal'>
            <Form.TextArea
              label='缓存写入倍率'
              name='CacheWriteRatio'
              onChange={handleInputChange}
              style={{ minHeight: 250, fontFamily: 'JetBrains Mono, Consolas' }}
              autoComplete='new-password'
              value={inputs.CacheWriteRatio}
              placeholder='为一个 JSON 文本，键为模型名称，值为缓存写入（写缓存）输入 token 的加价系数（如 Anthropic 为 1.25 表示 1.25 倍），未配置的模型默认按正常输入计费'
            />
          </Form.Group>
          <Form.Button onClick={() => {
            submitConfig('ratio').then();
          }}>保存倍率设置</Form.Button>
        </Form>
    </div>
  );
};

export default OperationSetting;
