import React, {useEffect, useState} from 'react';
import {API, isMobile, showError, showInfo, showSuccess} from '../../helpers';
import {renderNumber, renderQuota} from '../../helpers/render';
import {Col, Layout, Row, Typography, Card, Button, Form, Divider, Space, Modal} from "@douyinfe/semi-ui";
import Title from "@douyinfe/semi-ui/lib/es/typography/title";
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { Link } from 'react-router-dom';

const TopUp = () => {
    const [redemptionCode, setRedemptionCode] = useState('');
    const [topUpCode, setTopUpCode] = useState('');
    const [topUpCount, setTopUpCount] = useState(10);
    const [minTopupCount, setMinTopUpCount] = useState(1);
    const [amount, setAmount] = useState(0.0);
    const [minTopUp, setMinTopUp] = useState(1);
    const [topUpLink, setTopUpLink] = useState('');
    const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
    const [userQuota, setUserQuota] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [payWay, setPayWay] = useState('');

    const topUp = async () => {
        if (redemptionCode === '') {
            showInfo('请输入兑换码！')
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await API.post('/api/user/topup', {
                key: redemptionCode
            });
            const {success, message, data} = res.data;
            if (success) {
                showSuccess('兑换成功！');
                Modal.success({title: '兑换成功！', content: '成功兑换额度：' + renderQuota(data), centered: true});
                setUserQuota((quota) => {
                    return quota + data;
                });
                setRedemptionCode('');
            } else {
                showError(message);
            }
        } catch (err) {
            showError('请求失败');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openTopUpLink = () => {
        if (!topUpLink) {
            showError('超级管理员未设置充值链接！');
            return;
        }
        window.open(topUpLink, '_blank');
    };

    const preTopUp = async (payment) => {
        if (!enableOnlineTopUp) {
            showError('超级管理员未开启在线充值！');
            return;
        }
        if (topUpCount < minTopUp) {
            showInfo('充值数量不能小于' + minTopUp);
            return;
        }
        setPayWay(payment);
        setOpen(true);
    };

    const onlineTopUp = async () => {
        setOpen(false);
        try {
            const res = await API.post('/api/user/topup/online', {
                amount: topUpCount,
                payWay: payWay,
                topUpCode: topUpCode
            });
            const {success, message, data} = res.data;
            if (success) {
                if (payWay === 'zfb') {
                    window.open(data, '_blank');
                } else if (payWay === 'wx') {
                    Modal.success({title: '请使用微信扫码支付', content: <img src={data} style={{width: '100%'}} />, centered: true});
                }
            } else {
                showError(message);
            }
        } catch (err) {
            showError('请求失败');
        }
    };

    const getUserQuota = async () => {
        try {
            const res = await API.get('/api/user/self');
            const {success, message, data} = res.data;
            if (success) {
                setUserQuota(data.quota);
            } else {
                showError(message);
            }
        } catch (err) {
            showError('请求失败');
        }
    };

    useEffect(() => {
        let status = localStorage.getItem('status');
        if (status) {
            status = JSON.parse(status);
            if (status.top_up_link) {
                setTopUpLink(status.top_up_link);
            }
            if (status.min_topup) {
                setMinTopUp(status.min_topup);
            }
            if (status.enable_online_topup) {
                setEnableOnlineTopUp(status.enable_online_topup);
            }
        }
        getUserQuota().then();
    }, []);

    const renderAmount = () => {
        return amount + '元';
    }

    const getAmount = async (value) => {
        if (value === undefined) {
            value = topUpCount;
        }
        try {
            const res = await API.post('/api/user/amount', {
                amount: parseFloat(value),
                top_up_code: topUpCode
            });
            if (res !== undefined) {
                const {message, data} = res.data;
                if (message === 'success') {
                    setAmount(parseFloat(data));
                } else {
                    showError(data);
                }
            } else {
                showError(res);
            }
        } catch (err) {
            console.error(err);
        } finally {
        }
    }

    const handleCancel = () => {
        setOpen(false);
    }

    return (
        <div>
            <Layout>
                <Layout.Header>
                    <h3>充值额度</h3>
                </Layout.Header>
                <Layout.Content>
                    <Modal
                        title="确定要充值吗"
                        visible={open}
                        onOk={onlineTopUp}
                        onCancel={handleCancel}
                        maskClosable={false}
                        size={'small'}
                        centered={true}
                    >
                        <p>充值数量：{topUpCount}$</p>
                        <p>实付金额：{renderAmount()}</p>
                        <p>是否确认充值？</p>
                    </Modal>
                    <div style={{marginTop: 20, display: 'flex', justifyContent: 'center', padding: '0 8px'}}>
                        <Card
                            style={{width: '100%', maxWidth: '500px', padding: '20px'}}
                        >
                            <Title level={3} style={{textAlign: 'center'}}>余额 {renderQuota(userQuota)}</Title>
                            <div style={{marginTop: 20}}>
                                <Divider>
                                    兑换余额
                                </Divider>
                                <Form>
                                    <Form.Input
                                        field={'redemptionCode'}
                                        label={'兑换码'}
                                        placeholder='兑换码'
                                        name='redemptionCode'
                                        value={redemptionCode}
                                        onChange={(value) => {
                                            setRedemptionCode(value);
                                        }}
                                    />
                                    <Space wrap>
                                        {
                                            topUpLink ?
                                                <Button type={'primary'} theme={'solid'} onClick={openTopUpLink}>
                                                    获取兑换码
                                                </Button> : null
                                        }
                                        <Button type={"warning"} theme={'solid'} onClick={topUp}
                                                disabled={isSubmitting}>
                                            {isSubmitting ? '兑换中...' : '兑换'}
                                        </Button>
                                    </Space>
                                </Form>
                            </div>
                        </Card>
                    </div>

                </Layout.Content>
            </Layout>
        </div>

    );
};

export default TopUp;
