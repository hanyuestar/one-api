import React, { useEffect, useState } from 'react';
import { API, copy, isAdmin, showError, showSuccess, timestamp2string } from '../helpers';

import { Avatar, Button, Form, Layout, Modal, Select, Space, Spin, Table, Tag } from '@douyinfe/semi-ui';
import { ITEMS_PER_PAGE } from '../constants';
import { renderNumber, renderQuota, stringToColor } from '../helpers/render';
import Paragraph from '@douyinfe/semi-ui/lib/es/typography/paragraph';

const { Header } = Layout;

function renderTimestamp(timestamp) {
  return (<>
    {timestamp2string(timestamp)}
  </>);
}

const MODE_OPTIONS = [{ key: 'all', text: '全部用户', value: 'all' }, { key: 'self', text: '当前用户', value: 'self' }];

const colors = ['amber', 'blue', 'cyan', 'green', 'grey', 'indigo', 'light-blue', 'lime', 'orange', 'pink', 'purple', 'red', 'teal', 'violet', 'yellow'];

function renderType(type) {
  switch (type) {
    case 1:
      return <Tag color="cyan" size="large"> 充值 </Tag>;
    case 2:
      return <Tag color="lime" size="large"> 消费 </Tag>;
    case 3:
      return <Tag color="orange" size="large"> 管理 </Tag>;
    case 4:
      return <Tag color="purple" size="large"> 系统 </Tag>;
    case 5:
      return <Tag color="violet" size="large"> 测试 </Tag>;
    default:
      return <Tag color="black" size="large"> 未知 </Tag>;
  }
}

function renderIsStream(bool) {
  if (bool) {
    return <Tag color="blue" size="large">流</Tag>;
  } else {
    return <Tag color="purple" size="large">非流</Tag>;
  }
}

function renderUseTime(type) {
  const time = parseInt(type);
  if (time < 101) {
    return <Tag color="green" size="large"> {time} s </Tag>;
  } else if (time < 300) {
    return <Tag color="orange" size="large"> {time} s </Tag>;
  } else {
    return <Tag color="red" size="large"> {time} s </Tag>;
  }
}

// 解析并渲染结构化计费明细（billing_detail JSON）；解析失败/为空则回退到 content 字符串
function renderBillingDetail(record) {
  let bd = null;
  try {
    if (record.billing_detail) bd = JSON.parse(record.billing_detail);
  } catch (e) { bd = null; }
  if (!bd || typeof bd !== 'object') {
    return <div><b>计费明细：</b>{record.content || '—'}</div>;
  }
  const r2 = (v) => (typeof v === 'number' ? v.toFixed(2) : (v ?? '—'));
  return (
    <div>
      <div><b>计费公式：</b>(正常输入 {bd.normal_prompt} + 缓存命中 {bd.billing_cache_hit}×{r2(bd.cache_hit_ratio)} + 缓存写入 {bd.billing_cache_write}×{r2(bd.cache_write_ratio)} + 输出 {bd.completion_tokens}×{r2(bd.completion_ratio)}) × 模型倍率 {r2(bd.model_ratio)} × 分组倍率 {r2(bd.group_ratio)} = {bd.quota}</div>
      <div><b>分量：</b>原始输入 {bd.prompt_tokens} / 正常输入 {bd.normal_prompt}；缓存命中 原始 {bd.cache_hit_tokens} / 计费 {bd.billing_cache_hit}；缓存写入 原始 {bd.cache_write_tokens} / 计费 {bd.billing_cache_write}；输出 {bd.completion_tokens}</div>
      <div><b>比率：</b>模型 {r2(bd.model_ratio)} × 分组 {r2(bd.group_ratio)} × 输出 {r2(bd.completion_ratio)}；缓存命中 {r2(bd.cache_hit_ratio)}、缓存写入 {r2(bd.cache_write_ratio)}；渠道类型 {bd.channel_type}</div>
    </div>
  );
}

const LogsTable = () => {
  const columns = [{
    title: '时间', dataIndex: 'timestamp2string', width: 160
  }, {
    title: '渠道',
    dataIndex: 'channel',
    width: 80,
    className: isAdmin() ? 'tableShow' : 'tableHiddle',
    render: (text, record, index) => {
      return (isAdminUser ? record.type === 0 || record.type === 2 ? <div>
        {<Tag color={colors[parseInt(text) % colors.length]} size="large"> {text} </Tag>}
      </div> : <></> : <></>);
    }
  }, {
    title: '用户',
    dataIndex: 'username',
    width: 120,
    className: isAdmin() ? 'tableShow' : 'tableHiddle',
    render: (text, record, index) => {
      return (isAdminUser ? <div>
        <Avatar size="small" color={stringToColor(text)} style={{ marginRight: 4 }}
          onClick={() => showUserInfo(record.user_id)}>
          {typeof text === 'string' && text.slice(0, 1)}
        </Avatar>
        {text}
      </div> : <></>);
    }
  }, {
    title: '令牌', dataIndex: 'token_name', width: 120, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>
        <Tag color="grey" size="large" onClick={() => {
          copyText(text);
        }}> {text} </Tag>
      </div> : <></>);
    }
  }, {
    title: '类型', dataIndex: 'type', width: 80, render: (text, record, index) => {
      return (<div>
        {renderType(text)}
      </div>);
    }
  }, {
    title: '模型', dataIndex: 'model_name', width: 160, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>
        <Tag color={stringToColor(text)} size="large" onClick={() => {
          copyText(text);
        }}> {text} </Tag>
      </div> : <></>);
    }
  },
  {
    title: '用时', dataIndex: 'elapsed_time', width: 90, render: (text, record, index) => {
      return (<div>{text ? (text / 1000).toFixed(1) + ' s' : ''}</div>);
    }
  },
  {
    title: '首字', dataIndex: 'first_token_time', width: 90, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>{text ? (text / 1000).toFixed(1) + ' s' : '—'}</div> : <></>);
    }
  },
  {
    title: '输入', dataIndex: 'prompt_tokens', width: 120, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>
        {<span> {text}{record.cache_hit_tokens ? `（缓存命中 ${record.cache_hit_tokens}）` : ''} </span>}
      </div> : <></>);
    }
  }, {
    title: '输出', dataIndex: 'completion_tokens', width: 100, render: (text, record, index) => {
      return (parseInt(text) > 0 && (record.type === 0 || record.type === 2) ? <div>
        {<span> {text} </span>}
      </div> : <></>);
    }
  },   {
    title: '花费', dataIndex: 'quota', width: 110, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>
        {renderQuota(text, 6)}
      </div> : <></>);
    }
  }, {
    title: '分组', dataIndex: 'group', width: 90, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>{text || ''}</div> : <></>);
    }
  }, {
    title: 'IP', dataIndex: 'ip', width: 130, render: (text, record, index) => {
      return (record.type === 0 || record.type === 2 ? <div>{text || ''}</div> : <></>);
    }
  }, {
    title: '详情', dataIndex: 'content', width: 240, render: (text, record, index) => {
      return <Paragraph ellipsis={{ rows: 2, showTooltip: { type: 'popover', opts: { style: { width: 240 } } } }}
        style={{ maxWidth: 240 }}>
        {text}
      </Paragraph>;
    }
  }];

  const [logs, setLogs] = useState([]);
  const [showStat, setShowStat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStat, setLoadingStat] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(ITEMS_PER_PAGE);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [logType, setLogType] = useState(0);
  const isAdminUser = isAdmin();
  let now = new Date();
  // 初始化start_timestamp为前一天
  const [inputs, setInputs] = useState({
    username: '',
    token_name: '',
    model_name: '',
    start_timestamp: timestamp2string(now.getTime() / 1000 - 86400),
    end_timestamp: timestamp2string(now.getTime() / 1000 + 3600),
    channel: ''
  });
  const { username, token_name, model_name, start_timestamp, end_timestamp, channel } = inputs;

  const [stat, setStat] = useState({
    quota: 0, token: 0, count: 0
  });

  const handleInputChange = (value, name) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const getLogSelfStat = async () => {
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let res = await API.get(`/api/log/self/stat?type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`);
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const getLogStat = async () => {
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let res = await API.get(`/api/log/stat?type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}`);
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const handleEyeClick = async () => {
    setLoadingStat(true);
    if (isAdminUser) {
      await getLogStat();
    } else {
      await getLogSelfStat();
    }
    setShowStat(true);
    setLoadingStat(false);
  };

  const showUserInfo = async (userId) => {
    if (!isAdminUser) {
      return;
    }
    const res = await API.get(`/api/user/${userId}`);
    const { success, message, data } = res.data;
    if (success) {
      Modal.info({
        title: '用户信息', content: <div style={{ padding: 12 }}>
          <p>用户名: {data.username}</p>
          <p>余额: {renderQuota(data.quota)}</p>
          <p>已用额度：{renderQuota(data.used_quota)}</p>
          <p>请求次数：{renderNumber(data.request_count)}</p>
        </div>, centered: true
      });
    } else {
      showError(message);
    }
  };

  const setLogsFormat = (logs) => {
    for (let i = 0; i < logs.length; i++) {
      logs[i].timestamp2string = timestamp2string(logs[i].created_at);
      logs[i].key = '' + logs[i].id;
    }
    // data.key = '' + data.id
    setLogs(logs);
    setLogCount(logs.length + ITEMS_PER_PAGE);
    // console.log(logCount);
  };

  const loadLogs = async (startIdx, pageSize, logType = 0) => {
    setLoading(true);

    let url = '';
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    if (isAdminUser) {
      url = `/api/log/?p=${startIdx}&page_size=${pageSize}&type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}`;
    } else {
      url = `/api/log/self/?p=${startIdx}&page_size=${pageSize}&type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    }
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setLogsFormat(data);
      } else {
        let newLogs = [...logs];
        newLogs.splice(startIdx * pageSize, data.length, ...data);
        setLogsFormat(newLogs);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const pageData = logs.slice((activePage - 1) * pageSize, activePage * pageSize);

  const handlePageChange = page => {
    setActivePage(page);
    if (page === Math.ceil(logs.length / pageSize) + 1) {
      // In this case we have to load more data and then append them.
      loadLogs(page - 1, pageSize).then(r => {
      });
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadLogs(0, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  const refresh = async (localLogType) => {
    // setLoading(true);
    setActivePage(1);
    await loadLogs(0, pageSize, localLogType);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess('已复制：' + text);
    } else {
      // setSearchKeyword(text);
      Modal.error({ title: '无法复制到剪贴板，请手动复制', content: text });
    }
  };

  useEffect(() => {
    // console.log('default effect')
    const localPageSize = parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(0, localPageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    if (isAdminUser) {
      getLogStat();
    } else {
      getLogSelfStat();
    }
  }, []);

  const searchLogs = async () => {
    if (searchKeyword === '') {
      // if keyword is blank, load files instead.
      await loadLogs(0, pageSize);
      setActivePage(1);
      return;
    }
    setSearching(true);
    const res = await API.get(`/api/log/self/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      setLogs(data);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  return (<>
    <Layout>
      <Header>
        <Spin spinning={loadingStat}>
          <h3>使用明细</h3>
          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>总消耗额度</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{renderQuota(stat.quota)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>总 Token</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{renderNumber(stat.token)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>请求数</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{renderNumber(stat.count)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>平均首字延迟</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{stat.avg_first_token_time ? (stat.avg_first_token_time / 1000).toFixed(2) + ' s' : '—'}</div>
            </div>
          </div>
        </Spin>
      </Header>
      <Form layout="horizontal" style={{ marginTop: 10 }}>
        <>
          <Form.Input field="token_name" label="令牌名称" style={{ width: 176 }} value={token_name}
            placeholder={'可选值'} name="token_name"
            onChange={value => handleInputChange(value, 'token_name')} />
          <Form.Input field="model_name" label="模型名称" style={{ width: 176 }} value={model_name}
            placeholder="可选值"
            name="model_name"
            onChange={value => handleInputChange(value, 'model_name')} />
          <Form.DatePicker field="start_timestamp" label="起始时间" style={{ width: 272 }}
            initValue={start_timestamp}
            value={start_timestamp} type="dateTime"
            name="start_timestamp"
            onChange={value => handleInputChange(value, 'start_timestamp')} />
          <Form.DatePicker field="end_timestamp" fluid label="结束时间" style={{ width: 272 }}
            initValue={end_timestamp}
            value={end_timestamp} type="dateTime"
            name="end_timestamp"
            onChange={value => handleInputChange(value, 'end_timestamp')} />
          {isAdminUser && <>
            <Form.Input field="channel" label="渠道 ID" style={{ width: 176 }} value={channel}
              placeholder="可选值" name="channel"
              onChange={value => handleInputChange(value, 'channel')} />
            <Form.Input field="username" label="用户名称" style={{ width: 176 }} value={username}
              placeholder={'可选值'} name="username"
              onChange={value => handleInputChange(value, 'username')} />
          </>}
          <Form.Section>
            <Button label="查询" type="primary" htmlType="submit" className="btn-margin-right"
              onClick={refresh} loading={loading}>查询</Button>
          </Form.Section>
        </>
      </Form>
      <Table style={{ marginTop: 5 }} columns={columns} dataSource={pageData}
        scroll={{ x: 1500 }}
        expandedRowRender={(record) => (
          <div style={{ padding: '8px 12px', lineHeight: 1.9 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <span><b>Request ID：</b>{record.request_id || '—'}</span>
              <span><b>缓存命中：</b>{record.cache_hit_tokens || 0}</span>
              <span><b>缓存写入：</b>{record.cache_write_tokens || 0}</span>
              <span><b>首字延迟：</b>{record.first_token_time ? (record.first_token_time / 1000).toFixed(2) + ' s' : '—'}</span>
              <span><b>总耗时：</b>{record.elapsed_time ? (record.elapsed_time / 1000).toFixed(2) + ' s' : '—'}</span>
            </div>
            {renderBillingDetail(record)}
          </div>
        )}
        pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: logCount,
        pageSizeOpts: [10, 20, 50, 100],
        showSizeChanger: true,
        onPageSizeChange: (size) => {
          handlePageSizeChange(size).then();
        },
        onPageChange: handlePageChange
      }} />
      <Select defaultValue="0" style={{ width: 120 }} onChange={(value) => {
        setLogType(parseInt(value));
        refresh(parseInt(value)).then();
      }}>
        <Select.Option value="0">全部</Select.Option>
        <Select.Option value="1">充值</Select.Option>
        <Select.Option value="2">消费</Select.Option>
        <Select.Option value="3">管理</Select.Option>
        <Select.Option value="4">系统</Select.Option>
      </Select>
    </Layout>
  </>);
};

export default LogsTable;
