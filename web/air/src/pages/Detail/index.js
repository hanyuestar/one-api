import React, {useEffect, useRef, useState} from 'react';
import {Button, Col, Form, Layout, Row, Spin, Table} from "@douyinfe/semi-ui";
import VChart from '@visactor/vchart';
import {API, isAdmin, showError, timestamp2string, timestamp2string1} from "../../helpers";
import {
    getQuotaWithUnit, modelColorMap,
    renderNumber,
    renderQuota,
    renderQuotaNumberWithDigit,
    stringToColor
} from "../../helpers/render";

const Detail = (props) => {
    const formRef = useRef();
    let now = new Date();
    const [inputs, setInputs] = useState({
        username: '',
        token_name: '',
        model_name: '',
        start_timestamp: localStorage.getItem('data_export_default_time') === 'hour' ? timestamp2string(now.getTime() / 1000 - 86400) : (localStorage.getItem('data_export_default_time') === 'week' ? timestamp2string(now.getTime() / 1000 - 86400 * 30) : timestamp2string(now.getTime() / 1000 - 86400 * 7)),
        end_timestamp: timestamp2string(now.getTime() / 1000 + 3600),
        channel: '',
        data_export_default_time: ''
    });
    const {username, model_name, start_timestamp, end_timestamp, channel} = inputs;
    const isAdminUser = isAdmin();
    const initialized = useRef(false)
    const [modelDataChart, setModelDataChart] = useState(null);
    const [modelDataPieChart, setModelDataPieChart] = useState(null);
    const [loading, setLoading] = useState(false);
    const [quotaData, setQuotaData] = useState([]);
    const [consumeQuota, setConsumeQuota] = useState(0);
    const [times, setTimes] = useState(0);
    const [self, setSelf] = useState({ quota: 0, used_quota: 0, request_count: 0 });
    const [tokenTotal, setTokenTotal] = useState(0);
    const [modelAnalysis, setModelAnalysis] = useState([]);
    const [dataExportDefaultTime, setDataExportDefaultTime] = useState(localStorage.getItem('data_export_default_time') || 'hour');

    const handleInputChange = (value, name) => {
        if (name === 'data_export_default_time') {
            setDataExportDefaultTime(value);
            return
        }
        setInputs((inputs) => ({...inputs, [name]: value}));
    };

    const spec_line = {
        type: 'bar',
        data: [
            {
                id: 'barData',
                values: []
            }
        ],
        xField: 'Time',
        yField: 'Usage',
        seriesField: 'Model',
        stack: true,
        legends: {
            visible: true
        },
        title: {
            visible: true,
            text: '模型消耗分布',
            subtext: '0'
        },
        bar: {
            // The state style of bar
            state: {
                hover: {
                    stroke: '#000',
                    lineWidth: 1
                }
            }
        },
        tooltip: {
            mark: {
                content: [
                    {
                        key: datum => datum['Model'],
                        value: datum => renderQuotaNumberWithDigit(parseFloat(datum['Usage']), 4)
                    }
                ]
            },
            dimension: {
                content: [
                    {
                        key: datum => datum['Model'],
                        value: datum => datum['Usage']
                    }
                ],
                updateContent: array => {
                    // sort by value
                    array.sort((a, b) => b.value - a.value);
                    // add $
                    let sum = 0;
                    for (let i = 0; i < array.length; i++) {
                        sum += parseFloat(array[i].value);
                        array[i].value = renderQuotaNumberWithDigit(parseFloat(array[i].value), 4);
                    }
                    // add to first
                    array.unshift({
                        key: '总计',
                        value: renderQuotaNumberWithDigit(sum, 4)
                    });
                    return array;
                }
            }
        },
        color: {
            specified: modelColorMap
        }
    };

    const spec_pie = {
        type: 'pie',
        data: [
            {
                id: 'id0',
                values: [
                    {type: 'null', value: '0'},
                ]
            }
        ],
        outerRadius: 0.8,
        innerRadius: 0.5,
        padAngle: 0.6,
        valueField: 'value',
        categoryField: 'type',
        pie: {
            style: {
                cornerRadius: 10
            },
            state: {
                hover: {
                    outerRadius: 0.85,
                    stroke: '#000',
                    lineWidth: 1
                },
                selected: {
                    outerRadius: 0.85,
                    stroke: '#000',
                    lineWidth: 1
                }
            }
        },
        title: {
            visible: true,
            text: '模型调用次数占比'
        },
        legends: {
            visible: true,
            orient: 'left'
        },
        label: {
            visible: true
        },
        tooltip: {
            mark: {
                content: [
                    {
                        key: datum => datum['type'],
                        value: datum => renderNumber(datum['value'])
                    }
                ]
            }
        },
        color: {
            specified: modelColorMap
        }
    };

    const loadQuotaData = async (lineChart, pieChart) => {
        setLoading(true);

        let url = '';
        let localStartTimestamp = Date.parse(start_timestamp) / 1000;
        let localEndTimestamp = Date.parse(end_timestamp) / 1000;
        if (isAdminUser) {
            url = `/api/data/?username=${username}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
        } else {
            url = `/api/data/self/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
        }
        const res = await API.get(url);
        const {success, message, data} = res.data;
        if (success) {
            setQuotaData(data);
            if (data.length === 0) {
                data.push({
                    'count': 0,
                    'model_name': '无数据',
                    'quota': 0,
                    'created_at': now.getTime() / 1000
                })
            }
            // 根据dataExportDefaultTime重制时间粒度
            let timeGranularity = 3600;
            if (dataExportDefaultTime === 'day') {
                timeGranularity = 86400;
            } else if (dataExportDefaultTime === 'week') {
                timeGranularity = 604800;
            }
            data.forEach(item => {
                item['created_at'] = Math.floor(item['created_at'] / timeGranularity) * timeGranularity;
            });
            updateChart(lineChart, pieChart, data);
        } else {
            showError(message);
        }
        setLoading(false);
    };

    const refresh = async () => {
        await loadQuotaData(modelDataChart, modelDataPieChart);
    };

    const initChart = async () => {
        let lineChart = modelDataChart
        if (!modelDataChart) {
            lineChart = new VChart(spec_line, {dom: 'model_data'});
            setModelDataChart(lineChart);
            lineChart.renderAsync();
        }
        let pieChart = modelDataPieChart
        if (!modelDataPieChart) {
            pieChart = new VChart(spec_pie, {dom: 'model_pie'});
            setModelDataPieChart(pieChart);
            pieChart.renderAsync();
        }
        console.log('init vchart');
        await loadQuotaData(lineChart, pieChart)
    }

    const updateChart = (lineChart, pieChart, data) => {
        if (isAdminUser) {
            // 将所有用户合并
        }
        let pieData = [];
        let lineData = [];
        let consumeQuota = 0;
        let times = 0;
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            consumeQuota += item.quota;
            times += item.count;
            // 合并model_name
            let pieItem = pieData.find(it => it.type === item.model_name);
            if (pieItem) {
                pieItem.value += item.count;
            } else {
                pieData.push({
                    "type": item.model_name,
                    "value": item.count
                });
            }
            // 合并created_at和model_name 为 lineData, created_at 数据类型是小时的时间戳
            // 转换日期格式
            let createTime = timestamp2string1(item.created_at, dataExportDefaultTime);
            let lineItem = lineData.find(it => it.Time === createTime && it.Model === item.model_name);
            if (lineItem) {
                lineItem.Usage += parseFloat(getQuotaWithUnit(item.quota));
            } else {
                lineData.push({
                    "Time": createTime,
                    "Model": item.model_name,
                    "Usage": parseFloat(getQuotaWithUnit(item.quota))
                });
            }
        }
        setConsumeQuota(consumeQuota);
        setTimes(times);

        // sort by count
        pieData.sort((a, b) => b.value - a.value);
        spec_pie.title.subtext = `总计：${renderNumber(times)}`;
        spec_pie.data[0].values = pieData;

        spec_line.title.subtext = `总计：${renderQuota(consumeQuota, 2)}`;
        spec_line.data[0].values = lineData;
        pieChart.updateSpec(spec_pie);
        lineChart.updateSpec(spec_line);

        // pieChart.updateData('id0', pieData);
        // lineChart.updateData('barData', lineData);
        pieChart.reLayout();
        lineChart.reLayout();
    }

    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            initChart();
        }
        API.get('/api/user/self').then((res) => {
            const { success, data } = res.data;
            if (success && data) {
                setSelf({ quota: data.quota || 0, used_quota: data.used_quota || 0, request_count: data.request_count || 0 });
            }
        }).catch(() => {});
        API.get('/api/user/dashboard').then((res) => {
            const { success, data } = res.data;
            if (success && Array.isArray(data)) {
                const tk = data.reduce((s, d) => s + (d.PromptTokens || 0) + (d.CompletionTokens || 0), 0);
                setTokenTotal(tk);
            }
        }).catch(() => {});
        // C3 模型分析：按模型聚合（管理员全域 / 普通用户自身）
        API.get(isAdminUser ? '/api/log/model-analysis' : '/api/log/self/model-analysis').then((res) => {
            const { success, data } = res.data;
            if (success) setModelAnalysis(Array.isArray(data) ? data : []);
        }).catch(() => {});
    }, []);

    const modelAnalysisColumns = [
        { title: '模型', dataIndex: 'model_name' },
        { title: '请求数', dataIndex: 'request_count', render: (t) => renderNumber(t) },
        { title: '消耗额度', dataIndex: 'quota', render: (t) => renderQuota(t) },
        { title: 'Token 数', dataIndex: 'tokens', render: (text, record) => renderNumber((record.prompt_tokens || 0) + (record.completion_tokens || 0)) },
        { title: '平均首字延迟', dataIndex: 'avg_first_token_time', render: (t) => (t ? (t / 1000).toFixed(2) + ' s' : '—') },
        { title: '平均耗时', dataIndex: 'avg_elapsed_time', render: (t) => (t ? (t / 1000).toFixed(2) + ' s' : '—') },
    ];

    return (
        <>
            <Layout>
                <Layout.Header>
                    <h3>数据看板</h3>
                    <div style={{ display: 'flex', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>账户余额</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{renderQuota(self.quota)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>历史消耗</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{renderQuota(self.used_quota)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>请求次数</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{renderNumber(self.request_count)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>统计额度</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{renderQuota(consumeQuota)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>平均 RPM</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{renderNumber(Math.round(times / Math.max(1, (Date.parse(end_timestamp) - Date.parse(start_timestamp)) / 60000)))}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-1)' }}>平均 TPM</div>
                            <div style={{ fontSize: 20, fontWeight: 600 }}>{renderNumber(Math.round(tokenTotal / (7 * 1440)))}</div>
                        </div>
                    </div>
                </Layout.Header>
                <Layout.Content>
                    <Form ref={formRef} layout='horizontal' style={{marginTop: 10}}>
                        <>
                            <Form.DatePicker field="start_timestamp" label='起始时间' style={{width: 272}}
                                             initValue={start_timestamp}
                                             value={start_timestamp} type='dateTime'
                                             name='start_timestamp'
                                             onChange={value => handleInputChange(value, 'start_timestamp')}/>
                            <Form.DatePicker field="end_timestamp" fluid label='结束时间' style={{width: 272}}
                                             initValue={end_timestamp}
                                             value={end_timestamp} type='dateTime'
                                             name='end_timestamp'
                                             onChange={value => handleInputChange(value, 'end_timestamp')}/>
                            <Form.Select field="data_export_default_time" label='时间粒度' style={{width: 176}}
                                         initValue={dataExportDefaultTime}
                                         placeholder={'时间粒度'} name='data_export_default_time'
                                         optionList={
                                             [
                                                 {label: '小时', value: 'hour'},
                                                 {label: '天', value: 'day'},
                                                 {label: '周', value: 'week'}
                                             ]
                                         }
                                         onChange={value => handleInputChange(value, 'data_export_default_time')}>
                            </Form.Select>
                            {
                                isAdminUser && <>
                                    <Form.Input field="username" label='用户名称' style={{width: 176}} value={username}
                                                placeholder={'可选值'} name='username'
                                                onChange={value => handleInputChange(value, 'username')}/>
                                </>
                            }
                            <Form.Section>
                                <Button label='查询' type="primary" htmlType="submit" className="btn-margin-right"
                                        onClick={refresh} loading={loading}>查询</Button>
                            </Form.Section>
                        </>
                    </Form>
                    <Spin spinning={loading}>
                        <div style={{height: 500}}>
                            <div id="model_pie" style={{width: '100%', minWidth: 100}}></div>
                        </div>
                        <div style={{height: 500}}>
                            <div id="model_data" style={{width: '100%', minWidth: 100}}></div>
                        </div>
                    </Spin>
                    <div style={{marginTop: 16}}>
                        <h4>模型分析</h4>
                        <Table columns={modelAnalysisColumns} dataSource={modelAnalysis} pagination={false} />
                    </div>
                </Layout.Content>
            </Layout>
        </>
    );
};


export default Detail;
