import React, { useEffect, useState, Fragment } from 'react';
import {
  Button,
  Form,
  Header,
  Label,
  Pagination,
  Segment,
  Select,
  Table,
  Card,
  Popup,
} from 'semantic-ui-react';
import {
  API,
  copy,
  isAdmin,
  showError,
  showSuccess,
  showWarning,
  timestamp2string,
} from '../helpers';
import { useTranslation } from 'react-i18next';

import { ITEMS_PER_PAGE } from '../constants';
import { renderColorLabel, renderNumber, renderQuota } from '../helpers/render';
import { Link } from 'react-router-dom';

function renderTimestamp(timestamp, request_id) {
  return (
    <code
      onClick={async () => {
        if (await copy(request_id)) {
          showSuccess(`已复制请求 ID：${request_id}`);
        } else {
          showWarning(`请求 ID 复制失败：${request_id}`);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {timestamp2string(timestamp)}
    </code>
  );
}

const MODE_OPTIONS = [
  { key: 'all', text: '全部用户', value: 'all' },
  { key: 'self', text: '当前用户', value: 'self' },
];

function renderType(type) {
  switch (type) {
    case 1:
      return (
        <Label basic color='green'>
          充值
        </Label>
      );
    case 2:
      return (
        <Label basic color='olive'>
          消费
        </Label>
      );
    case 3:
      return (
        <Label basic color='orange'>
          管理
        </Label>
      );
    case 4:
      return (
        <Label basic color='purple'>
          系统
        </Label>
      );
    case 5:
      return (
        <Label basic color='violet'>
          测试
        </Label>
      );
    default:
      return (
        <Label basic color='black'>
          未知
        </Label>
      );
  }
}

function getColorByElapsedTime(elapsedTime) {
  if (elapsedTime === undefined || 0) return 'black';
  if (elapsedTime < 1000) return 'green';
  if (elapsedTime < 3000) return 'olive';
  if (elapsedTime < 5000) return 'yellow';
  if (elapsedTime < 10000) return 'orange';
  return 'red';
}

function renderElapsedTime(elapsedTime) {
  if (!elapsedTime) return '';
  const seconds = elapsedTime / 1000;
  return seconds.toFixed(1) + ' s';
}

// 解析并渲染结构化计费明细（billing_detail JSON）；解析失败/为空则回退到 content 字符串
function renderBillingDetail(record) {
  let bd = null;
  try {
    if (record.billing_detail) bd = JSON.parse(record.billing_detail);
  } catch (e) { bd = null; }
  if (!bd || typeof bd !== 'object') {
    return (
      <div>
        <b>计费明细：</b>
        {record.content || '—'}
      </div>
    );
  }
  const r2 = (v) => (typeof v === 'number' ? v.toFixed(2) : v ?? '—');
  return (
    <div>
      <div>
        <b>计费公式：</b>(正常输入 {bd.normal_prompt} + 缓存命中 {bd.billing_cache_hit}×{r2(bd.cache_hit_ratio)} + 缓存写入 {bd.billing_cache_write}×{r2(bd.cache_write_ratio)} + 输出 {bd.completion_tokens}×{r2(bd.completion_ratio)}) × 模型倍率 {r2(bd.model_ratio)} × 分组倍率 {r2(bd.group_ratio)} = {bd.quota}
      </div>
      <div>
        <b>分量：</b>原始输入 {bd.prompt_tokens} / 正常输入 {bd.normal_prompt}；缓存命中 原始 {bd.cache_hit_tokens} / 计费 {bd.billing_cache_hit}；缓存写入 原始 {bd.cache_write_tokens} / 计费 {bd.billing_cache_write}；输出 {bd.completion_tokens}
      </div>
      <div>
        <b>比率：</b>模型 {r2(bd.model_ratio)} × 分组 {r2(bd.group_ratio)} × 输出 {r2(bd.completion_ratio)}；缓存命中 {r2(bd.cache_hit_ratio)}、缓存写入 {r2(bd.cache_write_ratio)}；渠道类型 {bd.channel_type}
      </div>
    </div>
  );
}

function renderDetail(log) {
  return (
    <>
      {log.content}
      <br />
      {log.elapsed_time && (
        <Label
          basic
          size={'mini'}
          color={getColorByElapsedTime(log.elapsed_time)}
        >
          {log.elapsed_time} ms
        </Label>
      )}
      {log.is_stream && (
        <>
          <Label size={'mini'} color='pink'>
            Stream
          </Label>
        </>
      )}
      {log.system_prompt_reset && (
        <>
          <Label basic size={'mini'} color='red'>
            System Prompt Reset
          </Label>
        </>
      )}
    </>
  );
}

const LogsTable = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [showStat, setShowStat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [logType, setLogType] = useState(0);
  const isAdminUser = isAdmin();
  let now = new Date();
  const [inputs, setInputs] = useState({
    username: '',
    token_name: '',
    model_name: '',
    start_timestamp: timestamp2string(0),
    end_timestamp: timestamp2string(now.getTime() / 1000 + 3600),
    channel: '',
  });
  const {
    username,
    token_name,
    model_name,
    start_timestamp,
    end_timestamp,
    channel,
  } = inputs;

  const [stat, setStat] = useState({
    quota: 0,
    token: 0,
    count: 0,
  });
  const [expandedId, setExpandedId] = useState(null);

  const LOG_OPTIONS = [
    { key: '0', text: t('log.type.all'), value: 0 },
    { key: '1', text: t('log.type.topup'), value: 1 },
    { key: '2', text: t('log.type.usage'), value: 2 },
    { key: '3', text: t('log.type.admin'), value: 3 },
    { key: '4', text: t('log.type.system'), value: 4 },
    { key: '5', text: t('log.type.test'), value: 5 },
  ];

  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const getLogSelfStat = async () => {
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let res = await API.get(
      `/api/log/self/stat?type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`
    );
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
    let res = await API.get(
      `/api/log/stat?type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}`
    );
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const handleEyeClick = async () => {
    if (!showStat) {
      if (isAdminUser) {
        await getLogStat();
      } else {
        await getLogSelfStat();
      }
    }
    setShowStat(!showStat);
  };

  const showUserTokenQuota = () => {
    return logType !== 5;
  };

  const loadLogs = async (startIdx) => {
    let url = '';
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    if (isAdminUser) {
      url = `/api/log/?p=${startIdx}&type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}`;
    } else {
      url = `/api/log/self/?p=${startIdx}&type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    }
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setLogs(data);
      } else {
        let newLogs = [...logs];
        newLogs.splice(startIdx * ITEMS_PER_PAGE, data.length, ...data);
        setLogs(newLogs);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(logs.length / ITEMS_PER_PAGE) + 1) {
        // In this case we have to load more data and then append them.
        await loadLogs(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  const refresh = async () => {
    setLoading(true);
    setActivePage(1);
    await loadLogs(0);
    if (isAdminUser) {
      await getLogStat();
    } else {
      await getLogSelfStat();
    }
  };

  useEffect(() => {
    refresh().then();
  }, [logType]);

  const searchLogs = async () => {
    if (searchKeyword === '') {
      // if keyword is blank, load files instead.
      await loadLogs(0);
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

  const handleKeywordChange = async (e, { value }) => {
    setSearchKeyword(value.trim());
  };

  const sortLog = (key) => {
    if (logs.length === 0) return;
    setLoading(true);
    let sortedLogs = [...logs];
    if (typeof sortedLogs[0][key] === 'string') {
      sortedLogs.sort((a, b) => {
        return ('' + a[key]).localeCompare(b[key]);
      });
    } else {
      sortedLogs.sort((a, b) => {
        if (a[key] === b[key]) return 0;
        if (a[key] > b[key]) return -1;
        if (a[key] < b[key]) return 1;
      });
    }
    if (sortedLogs[0].id === logs[0].id) {
      sortedLogs.reverse();
    }
    setLogs(sortedLogs);
    setLoading(false);
  };

  return (
    <>
      <Header as='h3'>{t('log.usage_details')}</Header>
      <Card.Group style={{ marginBottom: '12px' }} itemsPerRow={4}>
        <Card color='blue'>
          <Card.Content>
            <Card.Meta>总消耗额度</Card.Meta>
            <Card.Header>{renderQuota(stat.quota, t)}</Card.Header>
          </Card.Content>
        </Card>
        <Card color='teal'>
          <Card.Content>
            <Card.Meta>总 Token</Card.Meta>
            <Card.Header>{renderNumber(stat.token)}</Card.Header>
          </Card.Content>
        </Card>
        <Card color='purple'>
          <Card.Content>
            <Card.Meta>请求数</Card.Meta>
            <Card.Header>{renderNumber(stat.count)}</Card.Header>
          </Card.Content>
        </Card>
        <Card color='orange'>
          <Card.Content>
            <Card.Meta>平均首字延迟</Card.Meta>
            <Card.Header>
              {stat.avg_first_token_time
                ? (stat.avg_first_token_time / 1000).toFixed(2) + ' s'
                : '—'}
            </Card.Header>
          </Card.Content>
        </Card>
      </Card.Group>
      <Form>
        <Form.Group>
          <Form.Input
            fluid
            label={t('log.table.token_name')}
            size={'small'}
            width={3}
            value={token_name}
            placeholder={t('log.table.token_name_placeholder')}
            name='token_name'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label={t('log.table.model_name')}
            size={'small'}
            width={3}
            value={model_name}
            placeholder={t('log.table.model_name_placeholder')}
            name='model_name'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label={t('log.table.start_time')}
            size={'small'}
            width={4}
            value={start_timestamp}
            type='datetime-local'
            name='start_timestamp'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label={t('log.table.end_time')}
            size={'small'}
            width={4}
            value={end_timestamp}
            type='datetime-local'
            name='end_timestamp'
            onChange={handleInputChange}
          />
          <Form.Button
            fluid
            label={t('log.buttons.query')}
            size={'small'}
            width={2}
            onClick={refresh}
          >
            {t('log.buttons.submit')}
          </Form.Button>
        </Form.Group>
        {isAdminUser && (
          <>
            <Form.Group>
              <Form.Input
                fluid
                label={t('log.table.channel_id')}
                size={'small'}
                width={3}
                value={channel}
                placeholder={t('log.table.channel_id_placeholder')}
                name='channel'
                onChange={handleInputChange}
              />
              <Form.Input
                fluid
                label={t('log.table.username')}
                size={'small'}
                width={3}
                value={username}
                placeholder={t('log.table.username_placeholder')}
                name='username'
                onChange={handleInputChange}
              />
            </Form.Group>
          </>
        )}
        <Form.Input
          icon='search'
          placeholder={t('log.search')}
          value={searchKeyword}
          onChange={(e, { value }) => setSearchKeyword(value)}
        />
      </Form>
      <Table basic={'very'} compact size='small'>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortLog('created_time');
              }}
              width={3}
            >
              {t('log.table.time')}
            </Table.HeaderCell>
            {isAdminUser && (
              <Table.HeaderCell
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  sortLog('channel');
                }}
                width={1}
              >
                {t('log.table.channel')}
              </Table.HeaderCell>
            )}
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortLog('type');
              }}
              width={1}
            >
              {t('log.table.type')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortLog('model_name');
              }}
              width={2}
            >
              {t('log.table.model')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortLog('elapsed_time');
              }}
              width={1}
            >
              用时
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortLog('first_token_time');
              }}
              width={1}
            >
              首字
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortLog('group');
              }}
              width={1}
            >
              分组
            </Table.HeaderCell>
            {isAdminUser && (
              <Table.HeaderCell
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  sortLog('ip');
                }}
                width={2}
              >
                IP
              </Table.HeaderCell>
            )}
            {showUserTokenQuota() && (
              <>
                {isAdminUser && (
                  <Table.HeaderCell
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      sortLog('username');
                    }}
                    width={2}
                  >
                    {t('log.table.username')}
                  </Table.HeaderCell>
                )}
                <Table.HeaderCell
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    sortLog('token_name');
                  }}
                  width={2}
                >
                  {t('log.table.token_name')}
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    sortLog('prompt_tokens');
                  }}
                  width={1}
                >
                  {t('log.table.prompt_tokens')}
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    sortLog('completion_tokens');
                  }}
                  width={1}
                >
                  {t('log.table.completion_tokens')}
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    sortLog('quota');
                  }}
                  width={1}
                >
                  {t('log.table.quota')}
                </Table.HeaderCell>
              </>
            )}
            <Table.HeaderCell>{t('log.table.detail')}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {logs
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((log, idx) => {
              if (log.deleted) return <></>;
              return (
                <Fragment key={log.id}>
                <Table.Row key={log.id}>
                  <Table.Cell>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === log.id ? null : log.id);
                      }}
                      style={{ cursor: 'pointer', marginRight: '6px', color: '#2185d0' }}
                    >
                      {expandedId === log.id ? '▼' : '▶'}
                    </span>
                    {renderTimestamp(log.created_at, log.request_id)}
                  </Table.Cell>
                  {isAdminUser && (
                    <Table.Cell>
                      {log.channel ? (
                        <Label
                          basic
                          as={Link}
                          to={`/channel/edit/${log.channel}`}
                        >
                          {log.channel}
                        </Label>
                      ) : (
                        ''
                      )}
                    </Table.Cell>
                  )}
                  <Table.Cell>{renderType(log.type)}</Table.Cell>
                  <Table.Cell>
                    {log.model_name ? renderColorLabel(log.model_name) : ''}
                  </Table.Cell>
                  <Table.Cell>
                    <Label
                      basic
                      size={'mini'}
                      color={getColorByElapsedTime(log.elapsed_time)}
                    >
                      {renderElapsedTime(log.elapsed_time)}
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <Label basic size={'mini'} color='blue'>
                      {log.first_token_time
                        ? (log.first_token_time / 1000).toFixed(1) + ' s'
                        : '—'}
                    </Label>
                  </Table.Cell>
                  <Table.Cell>{log.group ? log.group : ''}</Table.Cell>
                  {isAdminUser && (
                    <Table.Cell>{log.ip ? log.ip : ''}</Table.Cell>
                  )}
                  {showUserTokenQuota() && (
                    <>
                      {isAdminUser && (
                        <Table.Cell>
                          {log.username ? (
                            <Label
                              basic
                              as={Link}
                              to={`/user/edit/${log.user_id}`}
                            >
                              {log.username}
                            </Label>
                          ) : (
                            ''
                          )}
                        </Table.Cell>
                      )}
                      <Table.Cell>
                        {log.token_name ? renderColorLabel(log.token_name) : ''}
                      </Table.Cell>

                      <Table.Cell>
                        {log.prompt_tokens
                          ? log.cache_hit_tokens
                            ? `${log.prompt_tokens}（缓存命中 ${log.cache_hit_tokens}）`
                            : log.prompt_tokens
                          : ''}
                      </Table.Cell>
                      <Table.Cell>
                        {log.completion_tokens ? log.completion_tokens : ''}
                      </Table.Cell>
                      <Table.Cell>
                        {log.quota ? renderQuota(log.quota, t, 6) : ''}
                      </Table.Cell>
                    </>
                  )}

                  <Table.Cell>{renderDetail(log)}</Table.Cell>
                </Table.Row>
                {expandedId === log.id && (
                  <Table.Row key={log.id + '_expanded'}>
                    <Table.Cell colSpan={14} style={{ background: '#f7f8fa' }}>
                      <div style={{ lineHeight: 1.9 }}>
                        <div>
                          <b>Request ID：</b>
                          {log.request_id || '—'}
                        </div>
                        <div>
                          <b>缓存命中：</b>
                          {log.cache_hit_tokens || 0}　<b>缓存写入：</b>
                          {log.cache_write_tokens || 0}　<b>首字延迟：</b>
                          {log.first_token_time
                            ? (log.first_token_time / 1000).toFixed(2) + ' s'
                            : '—'}
                          　<b>总耗时：</b>
                          {log.elapsed_time
                            ? (log.elapsed_time / 1000).toFixed(2) + ' s'
                            : '—'}
                        </div>
                        {renderBillingDetail(log)}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
                </Fragment>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan={'10'}>
              <Select
                placeholder={t('log.type.select')}
                options={LOG_OPTIONS}
                style={{ marginRight: '8px' }}
                name='logType'
                value={logType}
                onChange={(e, { name, value }) => {
                  setLogType(value);
                }}
              />
              <Button size='small' onClick={refresh} loading={loading}>
                {t('log.buttons.refresh')}
              </Button>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(logs.length / ITEMS_PER_PAGE) +
                  (logs.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
                }
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </>
  );
};

export default LogsTable;
