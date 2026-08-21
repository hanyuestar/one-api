import React, { useEffect, useState } from 'react';
import { Button, Form, Typography } from '@douyinfe/semi-ui';
import { IconMail, IconLock } from '@douyinfe/semi-icons';
import { API, copy, showError, showNotice } from '../helpers';
import { useSearchParams } from 'react-router-dom';

const PasswordResetConfirm = () => {
  const [inputs, setInputs] = useState({
    email: '',
    token: ''
  });
  const { email, token } = inputs;

  const [loading, setLoading] = useState(false);

  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const [newPassword, setNewPassword] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    let token = searchParams.get('token');
    let email = searchParams.get('email');
    setInputs({
      token,
      email
    });
  }, []);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  async function handleSubmit(e) {
    setDisableButton(true);
    if (!email) return;
    setLoading(true);
    const res = await API.post(`/api/user/reset`, {
      email,
      token
    });
    const { success, message } = res.data;
    if (success) {
      let password = res.data.data;
      setNewPassword(password);
      await copy(password);
      showNotice(`新密码已复制到剪贴板：${password}`);
    } else {
      showError(message);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 450, margin: '48px auto', padding: '0 16px' }}>
      <Typography.Title heading={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.png" alt="logo" style={{ height: 32, marginRight: 8, verticalAlign: 'middle' }} />
        密码重置确认
      </Typography.Title>
      <Form size="large">
        <Form.Input
          prefix={<IconMail />}
          placeholder="邮箱地址"
          name="email"
          value={email}
          readonly
        />
        {newPassword && (
          <Form.Input
            prefix={<IconLock />}
            placeholder="新密码"
            name="newPassword"
            value={newPassword}
            readonly
            onClick={(e) => {
              e.target.select();
              navigator.clipboard.writeText(newPassword);
              showNotice(`密码已复制到剪贴板：${newPassword}`);
            }}
          />
        )}
        <Button
          theme="solid"
          type="primary"
          block
          size="large"
          onClick={handleSubmit}
          loading={loading}
          disabled={disableButton}
          style={{ marginTop: 12 }}
        >
          {disableButton ? `密码重置完成` : '提交'}
        </Button>
      </Form>
    </div>
  );
};

export default PasswordResetConfirm;
