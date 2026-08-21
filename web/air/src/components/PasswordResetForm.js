import React, { useEffect, useState } from 'react';
import { Button, Form, Typography } from '@douyinfe/semi-ui';
import { IconMail } from '@douyinfe/semi-icons';
import { API, showError, showInfo, showSuccess } from '../helpers';
import Turnstile from 'react-turnstile';

const PasswordResetForm = () => {
  const [inputs, setInputs] = useState({
    email: ''
  });
  const { email } = inputs;

  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

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

  function handleChange(value) {
    setInputs(inputs => ({ ...inputs, email: value }));
  }

  async function handleSubmit(e) {
    setDisableButton(true);
    if (!email) return;
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setLoading(true);
    const res = await API.get(
      `/api/reset_password?email=${email}&turnstile=${turnstileToken}`
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess('重置邮件发送成功，请检查邮箱！');
      setInputs({ ...inputs, email: '' });
    } else {
      showError(message);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 450, margin: '48px auto', padding: '0 16px' }}>
      <Typography.Title heading={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.png" alt="logo" style={{ height: 32, marginRight: 8, verticalAlign: 'middle' }} />
        密码重置
      </Typography.Title>
      <Form size="large">
        <Form.Input
          prefix={<IconMail />}
          placeholder="邮箱地址"
          name="email"
          value={email}
          onChange={handleChange}
          field="email"
        />
        {turnstileEnabled ? (
          <Turnstile
            sitekey={turnstileSiteKey}
            onVerify={(token) => {
              setTurnstileToken(token);
            }}
          />
        ) : (
          <></>
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
          {disableButton ? `重试 (${countdown})` : '提交'}
        </Button>
      </Form>
    </div>
  );
};

export default PasswordResetForm;
