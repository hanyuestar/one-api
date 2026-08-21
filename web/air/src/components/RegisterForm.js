import React, { useEffect, useState } from 'react';
import { Button, Form, Typography, Banner } from '@douyinfe/semi-ui';
import { IconUser, IconLock, IconMail } from '@douyinfe/semi-icons';
import { Link, useNavigate } from 'react-router-dom';
import { API, getLogo, showError, showInfo, showSuccess } from '../helpers';
import Turnstile from 'react-turnstile';

const RegisterForm = () => {
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    password2: '',
    email: '',
    verification_code: ''
  });
  const { username, password, password2 } = inputs;
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const logo = getLogo();
  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) {
    localStorage.setItem('aff', affCode);
  }

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      setShowEmailVerification(status.email_verification);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
  });

  let navigate = useNavigate();

  function handleChange(value, e) {
    const name = e.target.name;
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if (password.length < 8) {
      showInfo('密码长度不得小于 8 位！');
      return;
    }
    if (password !== password2) {
      showInfo('两次输入的密码不一致');
      return;
    }
    if (username && password) {
      if (turnstileEnabled && turnstileToken === '') {
        showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
        return;
      }
      setLoading(true);
      if (!affCode) {
        affCode = localStorage.getItem('aff');
      }
      inputs.aff_code = affCode;
      const res = await API.post(
        `/api/user/register?turnstile=${turnstileToken}`,
        inputs
      );
      const { success, message } = res.data;
      if (success) {
        navigate('/login');
        showSuccess('注册成功！');
      } else {
        showError(message);
      }
      setLoading(false);
    }
  }

  const sendVerificationCode = async () => {
    if (inputs.email === '') return;
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setLoading(true);
    const res = await API.get(
      `/api/verification?email=${inputs.email}&turnstile=${turnstileToken}`
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess('验证码发送成功，请检查你的邮箱！');
    } else {
      showError(message);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 450, margin: '48px auto', padding: '0 16px' }}>
      <Typography.Title heading={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src={logo} alt="logo" style={{ height: 32, marginRight: 8, verticalAlign: 'middle' }} />
        新用户注册
      </Typography.Title>
      <Form size="large">
        <Form.Input
          prefix={<IconUser />}
          placeholder="输入用户名，最长 12 位"
          onChange={handleChange}
          name="username"
          field="username"
        />
        <Form.Input
          prefix={<IconLock />}
          placeholder="输入密码，最短 8 位，最长 20 位"
          onChange={handleChange}
          name="password"
          type="password"
          mode="password"
          field="password"
        />
        <Form.Input
          prefix={<IconLock />}
          placeholder="再次输入密码"
          onChange={handleChange}
          name="password2"
          type="password"
          mode="password"
          field="password2"
        />
        {showEmailVerification ? (
          <>
            <Form.Input
              prefix={<IconMail />}
              placeholder="输入邮箱地址"
              onChange={handleChange}
              name="email"
              type="email"
              field="email"
              suffix={<Button onClick={sendVerificationCode} disabled={loading} size="small">获取验证码</Button>}
            />
            <Form.Input
              prefix={<IconLock />}
              placeholder="输入验证码"
              onChange={handleChange}
              name="verification_code"
              field="verification_code"
            />
          </>
        ) : (
          <></>
        )}
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
          style={{ marginTop: 12 }}
        >
          注册
        </Button>
      </Form>
      <Banner
        fullMode={false}
        type="info"
        style={{ marginTop: 16 }}
        description={<>已有账户？<Link to="/login">点击登录</Link></>}
      />
    </div>
  );
};

export default RegisterForm;
