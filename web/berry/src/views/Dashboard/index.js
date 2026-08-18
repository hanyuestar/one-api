import { useEffect, useState } from 'react';
import { Grid, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { gridSpacing } from 'store/constant';
import StatisticalLineChartCard from './component/StatisticalLineChartCard';
import StatisticalBarChart from './component/StatisticalBarChart';
import { generateChartOptions, getLastSevenDays } from 'utils/chart';
import { API } from 'utils/api';
import { showError, calculateQuota, renderNumber, isAdmin } from 'utils/common';
import UserCard from 'ui-component/cards/UserCard';
import MainCard from 'ui-component/cards/MainCard';

const Dashboard = () => {
  const [isLoading, setLoading] = useState(true);
  const [statisticalData, setStatisticalData] = useState([]);
  const [requestChart, setRequestChart] = useState(null);
  const [quotaChart, setQuotaChart] = useState(null);
  const [tokenChart, setTokenChart] = useState(null);
  const [users, setUsers] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [modelAnalysis, setModelAnalysis] = useState([]);

  // C3 模型分析：按模型聚合（管理员全域 / 普通用户自身）
  const loadModelAnalysis = async () => {
    const res = await API.get(isAdmin() ? '/api/log/model-analysis' : '/api/log/self/model-analysis');
    const { success, data } = res.data;
    if (success) {
      setModelAnalysis(Array.isArray(data) ? data : []);
    }
  };

  const userDashboard = async () => {
    const res = await API.get('/api/user/dashboard');
    const { success, message, data } = res.data;
    if (success) {
      if (data) {
        let lineData = getLineDataGroup(data);
        setRequestChart(getLineCardOption(lineData, 'RequestCount'));
        setQuotaChart(getLineCardOption(lineData, 'Quota'));
        setTokenChart(getLineCardOption(lineData, 'PromptTokens'));
        setStatisticalData(getBarDataGroup(data));
        setRawData(data);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const loadUser = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      setUsers(data);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    userDashboard();
    loadUser();
    loadModelAnalysis();
  }, []);

  const totalQuota = rawData.reduce((sum, item) => sum + (item.Quota || 0), 0);
  const totalTokens = rawData.reduce((sum, item) => sum + (item.PromptTokens || 0) + (item.CompletionTokens || 0), 0);
  const daysCount = rawData.length ? new Set(rawData.map((item) => item.Day)).size : 1;
  const minutes = daysCount * 1440;
  const totalRequests = rawData.reduce((sum, item) => sum + (item.RequestCount || 0), 0);
  const avgRPM = minutes ? totalRequests / minutes : 0;
  const avgTPM = minutes ? totalTokens / minutes : 0;

  return (
    <Grid container spacing={gridSpacing}>
      <Grid item xs={12}>
        <Grid container spacing={gridSpacing}>
          <Grid item lg={3} xs={6}>
            <MainCard title="账户数据">
              <Typography variant="h4">余额：{users?.quota ? '$' + calculateQuota(users.quota) : '未知'}</Typography>
              <Typography variant="subtitle2" color="text.secondary">历史消耗：{users?.used_quota ? '$' + calculateQuota(users.used_quota) : '未知'}</Typography>
            </MainCard>
          </Grid>
          <Grid item lg={3} xs={6}>
            <MainCard title="使用统计">
              <Typography variant="h4">请求次数：{users?.request_count || '未知'}</Typography>
            </MainCard>
          </Grid>
          <Grid item lg={3} xs={6}>
            <MainCard title="资源消耗">
              <Typography variant="h4">统计额度：{'$' + calculateQuota(totalQuota, 2)}</Typography>
              <Typography variant="subtitle2" color="text.secondary">统计 Tokens：{renderNumber(totalTokens)}</Typography>
            </MainCard>
          </Grid>
          <Grid item lg={3} xs={6}>
            <MainCard title="性能指标">
              <Typography variant="h4">平均 RPM：{avgRPM.toFixed(3)}</Typography>
              <Typography variant="subtitle2" color="text.secondary">平均 TPM：{renderNumber(Math.round(avgTPM))}</Typography>
            </MainCard>
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Grid container spacing={gridSpacing}>
          <Grid item lg={4} xs={12}>
            <StatisticalLineChartCard
              isLoading={isLoading}
              title="今日请求量"
              chartData={requestChart?.chartData}
              todayValue={requestChart?.todayValue}
            />
          </Grid>
          <Grid item lg={4} xs={12}>
            <StatisticalLineChartCard
              isLoading={isLoading}
              title="今日消费"
              chartData={quotaChart?.chartData}
              todayValue={quotaChart?.todayValue}
            />
          </Grid>
          <Grid item lg={4} xs={12}>
            <StatisticalLineChartCard
              isLoading={isLoading}
              title="今日 token"
              chartData={tokenChart?.chartData}
              todayValue={tokenChart?.todayValue}
            />
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Grid container spacing={gridSpacing}>
          <Grid item lg={8} xs={12}>
            <StatisticalBarChart isLoading={isLoading} chartDatas={statisticalData} />
          </Grid>
          <Grid item lg={4} xs={12}>
            <UserCard>
              <Grid container spacing={gridSpacing} justifyContent="center" alignItems="center" paddingTop={'20px'}>
                <Grid item xs={4}>
                  <Typography variant="h4">余额：</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="h3"> {users?.quota ? '$' + calculateQuota(users.quota) : '未知'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4">已使用：</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="h3"> {users?.used_quota ? '$' + calculateQuota(users.used_quota) : '未知'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4">调用次数：</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="h3"> {users?.request_count || '未知'}</Typography>
                </Grid>
              </Grid>
            </UserCard>
          </Grid>
        </Grid>
      </Grid>
      {/* 模型分析（C3）：按模型聚合的请求/额度/Token/首字延迟/耗时 */}
      <Grid item xs={12}>
        <MainCard title="模型分析">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>模型</TableCell>
                  <TableCell align="right">请求数</TableCell>
                  <TableCell align="right">消耗额度</TableCell>
                  <TableCell align="right">Token 数</TableCell>
                  <TableCell align="right">平均首字延迟</TableCell>
                  <TableCell align="right">平均耗时</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modelAnalysis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">暂无数据</TableCell>
                  </TableRow>
                ) : (
                  modelAnalysis.map((row) => (
                    <TableRow key={row.model_name}>
                      <TableCell>{row.model_name}</TableCell>
                      <TableCell align="right">{renderNumber(row.request_count)}</TableCell>
                      <TableCell align="right">${calculateQuota(row.quota, 2)}</TableCell>
                      <TableCell align="right">{renderNumber((row.prompt_tokens || 0) + (row.completion_tokens || 0))}</TableCell>
                      <TableCell align="right">{row.avg_first_token_time ? (row.avg_first_token_time / 1000).toFixed(2) + ' s' : '—'}</TableCell>
                      <TableCell align="right">{row.avg_elapsed_time ? (row.avg_elapsed_time / 1000).toFixed(2) + ' s' : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      </Grid>
    </Grid>
  );
};
export default Dashboard;

function getLineDataGroup(statisticalData) {
  let groupedData = statisticalData.reduce((acc, cur) => {
    if (!acc[cur.Day]) {
      acc[cur.Day] = {
        date: cur.Day,
        RequestCount: 0,
        Quota: 0,
        PromptTokens: 0,
        CompletionTokens: 0
      };
    }
    acc[cur.Day].RequestCount += cur.RequestCount;
    acc[cur.Day].Quota += cur.Quota;
    acc[cur.Day].PromptTokens += cur.PromptTokens;
    acc[cur.Day].CompletionTokens += cur.CompletionTokens;
    return acc;
  }, {});
  let lastSevenDays = getLastSevenDays();
  return lastSevenDays.map((day) => {
    if (!groupedData[day]) {
      return {
        date: day,
        RequestCount: 0,
        Quota: 0,
        PromptTokens: 0,
        CompletionTokens: 0
      };
    } else {
      return groupedData[day];
    }
  });
}

function getBarDataGroup(data) {
  const lastSevenDays = getLastSevenDays();
  const result = [];
  const map = new Map();

  for (const item of data) {
    if (!map.has(item.ModelName)) {
      const newData = { name: item.ModelName, data: new Array(7) };
      map.set(item.ModelName, newData);
      result.push(newData);
    }
    const index = lastSevenDays.indexOf(item.Day);
    if (index !== -1) {
      map.get(item.ModelName).data[index] = calculateQuota(item.Quota, 3);
    }
  }

  for (const item of result) {
    for (let i = 0; i < 7; i++) {
      if (item.data[i] === undefined) {
        item.data[i] = 0;
      }
    }
  }

  return { data: result, xaxis: lastSevenDays };
}

function getLineCardOption(lineDataGroup, field) {
  let todayValue = 0;
  let chartData = null;
  const lastItem = lineDataGroup.length - 1;
  let lineData = lineDataGroup.map((item, index) => {
    let tmp = {
      date: item.date,
      value: item[field]
    };
    switch (field) {
      case 'Quota':
        tmp.value = calculateQuota(item.Quota, 3);
        break;
      case 'PromptTokens':
        tmp.value += item.CompletionTokens;
        break;
    }

    if (index == lastItem) {
      todayValue = tmp.value;
    }
    return tmp;
  });

  switch (field) {
    case 'RequestCount':
      chartData = generateChartOptions(lineData, '次');
      todayValue = renderNumber(todayValue);
      break;
    case 'Quota':
      chartData = generateChartOptions(lineData, '美元');
      todayValue = '$' + renderNumber(todayValue);
      break;
    case 'PromptTokens':
      chartData = generateChartOptions(lineData, '');
      todayValue = renderNumber(todayValue);
      break;
  }

  return { chartData: chartData, todayValue: todayValue };
}
