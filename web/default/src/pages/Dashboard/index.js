import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Card, Grid, Table} from 'semantic-ui-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import axios from 'axios';
import { renderNumber, renderQuota } from '../../helpers/render';
import { isAdmin } from '../../helpers';
import './Dashboard.css';

// 在 Dashboard 组件内添加自定义配置
const chartConfig = {
  lineChart: {
    style: {
      background: '#fff',
      borderRadius: '8px',
    },
    line: {
      strokeWidth: 2,
      dot: false,
      activeDot: { r: 4 },
    },
    grid: {
      vertical: false,
      horizontal: true,
      opacity: 0.1,
    },
  },
  colors: {
    requests: '#4318FF',
    quota: '#00B5D8',
    tokens: '#6C63FF',
  },
  barColors: [
    '#4318FF', // 深紫色
    '#00B5D8', // 青色
    '#6C63FF', // 紫色
    '#05CD99', // 绿色
    '#FFB547', // 橙色
    '#FF5E7D', // 粉色
    '#41B883', // 翠绿
    '#7983FF', // 淡紫
    '#FF8F6B', // 珊瑚色
    '#49BEFF', // 天蓝
  ],
};

const Dashboard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [self, setSelf] = useState({ quota: 0, used_quota: 0, request_count: 0 });
  const [modelAnalysis, setModelAnalysis] = useState([]);
  const [summaryData, setSummaryData] = useState({
    todayRequests: 0,
    todayQuota: 0,
    todayTokens: 0,
  });

  useEffect(() => {
    fetchDashboardData();
    loadModelAnalysis();
  }, []);

  // C3 模型分析：按模型聚合（管理员全域 / 普通用户自身）
  const loadModelAnalysis = async () => {
    try {
      const url = isAdmin() ? '/api/log/model-analysis' : '/api/log/self/model-analysis';
      const res = await axios.get(url);
      if (res.data.success) {
        setModelAnalysis(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (e) {
      setModelAnalysis([]);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/api/user/dashboard');
      if (response.data.success) {
        const dashboardData = response.data.data || [];
        setData(dashboardData);
        calculateSummary(dashboardData);
      }
      const selfRes = await axios.get('/api/user/self');
      if (selfRes.data.success) {
        setSelf(selfRes.data.data || { quota: 0, used_quota: 0, request_count: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setData([]);
      calculateSummary([]);
    }
  };

  const calculateSummary = (dashboardData) => {
    if (!Array.isArray(dashboardData) || dashboardData.length === 0) {
      setSummaryData({
        todayRequests: 0,
        todayQuota: 0,
        todayTokens: 0,
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayData = dashboardData.filter((item) => item.Day === today);

    const summary = {
      todayRequests: todayData.reduce(
        (sum, item) => sum + item.RequestCount,
        0
      ),
      todayQuota:
        todayData.reduce((sum, item) => sum + item.Quota, 0) / 1000000,
      todayTokens: todayData.reduce(
        (sum, item) => sum + item.PromptTokens + item.CompletionTokens,
        0
      ),
    };

    setSummaryData(summary);
  };

  // 处理数据以供折线图使用，补充缺失的日期
  const processTimeSeriesData = () => {
    const dailyData = {};

    // 获取日期范围
    const dates = data.map((item) => item.Day);
    const maxDate = new Date(); // 总是使用今天作为最后一天
    let minDate =
      dates.length > 0
        ? new Date(Math.min(...dates.map((d) => new Date(d))))
        : new Date();

    // 确保至少显示7天的数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // -6是因为包含今天
    if (minDate > sevenDaysAgo) {
      minDate = sevenDaysAgo;
    }

    // 生成所有日期
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyData[dateStr] = {
        date: dateStr,
        requests: 0,
        quota: 0,
        tokens: 0,
      };
    }

    // 填充实际数据
    data.forEach((item) => {
      dailyData[item.Day].requests += item.RequestCount;
      dailyData[item.Day].quota += item.Quota / 1000000;
      dailyData[item.Day].tokens += item.PromptTokens + item.CompletionTokens;
    });

    return Object.values(dailyData).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  };

  // 处理数据以供堆叠柱状图使用
  const processModelData = () => {
    const timeData = {};

    // 获取日期范围
    const dates = data.map((item) => item.Day);
    const maxDate = new Date(); // 总是使用今天作为最后一天
    let minDate =
      dates.length > 0
        ? new Date(Math.min(...dates.map((d) => new Date(d))))
        : new Date();

    // 确保至少显示7天的数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // -6是因为包含今天
    if (minDate > sevenDaysAgo) {
      minDate = sevenDaysAgo;
    }

    // 生成所有日期
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      timeData[dateStr] = {
        date: dateStr,
      };

      // 初始化所有模型的数据为0
      const models = [...new Set(data.map((item) => item.ModelName))];
      models.forEach((model) => {
        timeData[dateStr][model] = 0;
      });
    }

    // 填充实际数据
    data.forEach((item) => {
      timeData[item.Day][item.ModelName] =
        item.PromptTokens + item.CompletionTokens;
    });

    return Object.values(timeData).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 获取所有唯一的模型名称
  const getUniqueModels = () => {
    return [...new Set(data.map((item) => item.ModelName))];
  };

  const timeSeriesData = processTimeSeriesData();
  const modelData = processModelData();
  const models = getUniqueModels();

  const totalQuotaRaw = data.reduce((sum, item) => sum + item.Quota, 0);
  const totalTokens = data.reduce((sum, item) => sum + item.PromptTokens + item.CompletionTokens, 0);
  const daysCount = data.length ? new Set(data.map((item) => item.Day)).size : 1;
  const minutes = daysCount * 1440;
  const totalRequests = data.reduce((sum, item) => sum + item.RequestCount, 0);
  const avgRPM = minutes ? totalRequests / minutes : 0;
  const avgTPM = minutes ? totalTokens / minutes : 0;

  // 生成随机颜色
  const getRandomColor = (index) => {
    return chartConfig.barColors[index % chartConfig.barColors.length];
  };

  // 添加一个日期格式化函数
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    });
  };

  // 修改所有 XAxis 配置
  const xAxisConfig = {
    dataKey: 'date',
    axisLine: false,
    tickLine: false,
    tick: {
      fontSize: 12,
      fill: '#A3AED0',
      textAnchor: 'middle', // 文本居中对齐
    },
    tickFormatter: formatDate,
    interval: 0,
    minTickGap: 5,
    padding: { left: 30, right: 30 }, // 增加两侧的内边距，确保首尾标签完整显示
  };

  return (
    <div className='dashboard-container'>
      {/* 四组摘要卡：账户数据 / 使用统计 / 资源消耗 / 性能指标 */}
      <Grid columns={4} stackable className='charts-grid' style={{ marginBottom: 16 }}>
        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>账户数据</Card.Header>
              <div style={{ marginTop: 8, lineHeight: 2 }}>
                <div>当前余额：{renderQuota(self.quota, t)}</div>
                <div>历史消耗：{renderQuota(self.used_quota, t)}</div>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>使用统计</Card.Header>
              <div style={{ marginTop: 8, lineHeight: 2 }}>
                <div>请求次数：{renderNumber(self.request_count)}</div>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>资源消耗</Card.Header>
              <div style={{ marginTop: 8, lineHeight: 2 }}>
                <div>统计额度：{renderQuota(totalQuotaRaw, t)}</div>
                <div>统计 Tokens：{renderNumber(totalTokens)}</div>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>性能指标</Card.Header>
              <div style={{ marginTop: 8, lineHeight: 2 }}>
                <div>平均 RPM：{avgRPM.toFixed(3)}</div>
                <div>平均 TPM：{renderNumber(Math.round(avgTPM))}</div>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
      </Grid>
      {/* 三个并排的折线图 */}
      <Grid columns={3} stackable className='charts-grid'>
        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>
                {t('dashboard.charts.requests.title')}
                {/* <span className='stat-value'>{summaryData.todayRequests}</span> */}
              </Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer
                  width='100%'
                  height={120}
                  margin={{ left: 10, right: 10 }} // 调整容器边距
                >
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      vertical={chartConfig.lineChart.grid.vertical}
                      horizontal={chartConfig.lineChart.grid.horizontal}
                      opacity={chartConfig.lineChart.grid.opacity}
                    />
                    <XAxis {...xAxisConfig} />
                    <YAxis hide={true} />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value) => [
                        value,
                        t('dashboard.charts.requests.tooltip'),
                      ]}
                      labelFormatter={(label) =>
                        `${t(
                          'dashboard.statistics.tooltip.date'
                        )}: ${formatDate(label)}`
                      }
                    />
                    <Line
                      type='monotone'
                      dataKey='requests'
                      stroke={chartConfig.colors.requests}
                      strokeWidth={chartConfig.lineChart.line.strokeWidth}
                      dot={chartConfig.lineChart.line.dot}
                      activeDot={chartConfig.lineChart.line.activeDot}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>

        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>
                {t('dashboard.charts.quota.title')}
                {/* <span className='stat-value'>
                  ${summaryData.todayQuota.toFixed(3)}
                </span> */}
              </Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer
                  width='100%'
                  height={120}
                  margin={{ left: 10, right: 10 }} // 调整容器边距
                >
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      vertical={chartConfig.lineChart.grid.vertical}
                      horizontal={chartConfig.lineChart.grid.horizontal}
                      opacity={chartConfig.lineChart.grid.opacity}
                    />
                    <XAxis {...xAxisConfig} />
                    <YAxis hide={true} />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value) => [
                        value.toFixed(6),
                        t('dashboard.charts.quota.tooltip'),
                      ]}
                      labelFormatter={(label) =>
                        `${t(
                          'dashboard.statistics.tooltip.date'
                        )}: ${formatDate(label)}`
                      }
                    />
                    <Line
                      type='monotone'
                      dataKey='quota'
                      stroke={chartConfig.colors.quota}
                      strokeWidth={chartConfig.lineChart.line.strokeWidth}
                      dot={chartConfig.lineChart.line.dot}
                      activeDot={chartConfig.lineChart.line.activeDot}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>

        <Grid.Column>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header>
                {t('dashboard.charts.tokens.title')}
                {/* <span className='stat-value'>{summaryData.todayTokens}</span> */}
              </Card.Header>
              <div className='chart-container'>
                <ResponsiveContainer
                  width='100%'
                  height={120}
                  margin={{ left: 10, right: 10 }} // 调整容器边距
                >
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      vertical={chartConfig.lineChart.grid.vertical}
                      horizontal={chartConfig.lineChart.grid.horizontal}
                      opacity={chartConfig.lineChart.grid.opacity}
                    />
                    <XAxis {...xAxisConfig} />
                    <YAxis hide={true} />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value) => [
                        value,
                        t('dashboard.charts.tokens.tooltip'),
                      ]}
                      labelFormatter={(label) =>
                        `${t(
                          'dashboard.statistics.tooltip.date'
                        )}: ${formatDate(label)}`
                      }
                    />
                    <Line
                      type='monotone'
                      dataKey='tokens'
                      stroke={chartConfig.colors.tokens}
                      strokeWidth={chartConfig.lineChart.line.strokeWidth}
                      dot={chartConfig.lineChart.line.dot}
                      activeDot={chartConfig.lineChart.line.activeDot}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </Grid.Column>
      </Grid>

      {/* 模型使用统计 */}
      <Card fluid className='chart-card'>
        <Card.Content>
          <Card.Header>{t('dashboard.statistics.title')}</Card.Header>
          <div className='chart-container'>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={modelData}>
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  opacity={0.1}
                />
                <XAxis {...xAxisConfig} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#A3AED0' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                  labelFormatter={(label) =>
                    `${t('dashboard.statistics.tooltip.date')}: ${formatDate(
                      label
                    )}`
                  }
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: '20px',
                  }}
                />
                {models.map((model, index) => (
                  <Bar
                    key={model}
                    dataKey={model}
                    stackId='a'
                    fill={getRandomColor(index)}
                    name={model}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Content>
      </Card>

      {/* 模型分析（C3）：按模型聚合的请求/额度/Token/首字延迟/耗时 */}
      <Card fluid className='chart-card' style={{ marginTop: 16 }}>
        <Card.Content>
          <Card.Header>模型分析</Card.Header>
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <Table basic='very' compact size='small'>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>模型</Table.HeaderCell>
                  <Table.HeaderCell>请求数</Table.HeaderCell>
                  <Table.HeaderCell>消耗额度</Table.HeaderCell>
                  <Table.HeaderCell>Token 数</Table.HeaderCell>
                  <Table.HeaderCell>平均首字延迟</Table.HeaderCell>
                  <Table.HeaderCell>平均耗时</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {modelAnalysis.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={6} textAlign='center'>
                      暂无数据
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  modelAnalysis.map((row) => (
                    <Table.Row key={row.model_name}>
                      <Table.Cell>{row.model_name}</Table.Cell>
                      <Table.Cell>{renderNumber(row.request_count)}</Table.Cell>
                      <Table.Cell>{renderQuota(row.quota, t)}</Table.Cell>
                      <Table.Cell>{renderNumber((row.prompt_tokens || 0) + (row.completion_tokens || 0))}</Table.Cell>
                      <Table.Cell>
                        {row.avg_first_token_time ? (row.avg_first_token_time / 1000).toFixed(2) + ' s' : '—'}
                      </Table.Cell>
                      <Table.Cell>
                        {row.avg_elapsed_time ? (row.avg_elapsed_time / 1000).toFixed(2) + ' s' : '—'}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default Dashboard;
