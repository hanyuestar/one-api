import React, { useContext, useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Button,
  Icon,
  Message,
} from 'semantic-ui-react';
import { API, showError, showSuccess } from '../helpers';
import { UserContext } from '../context/User';

const ForceResetPasswordModal = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (userState?.user && userState.user.force_reset) {
      setOpen(true);
    }
  }, [userState]);

  if (!userState?.user || !userState.user.force_reset) {
    return null;
  }

  const submit = async () => {
    setErrorMsg('');
    if (password.length < 8) {
      setErrorMsg('密码长度至少 8 位');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await API.put('/api/user/self', {
        username: userState.user.username,
        password,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess('密码修改成功');
        // 更新本地用户状态，清除 force_reset
        const updatedUser = { ...userState.user, force_reset: false };
        userDispatch({ type: 'login', payload: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setOpen(false);
      } else {
        setErrorMsg(message || '修改失败');
      }
    } catch (e) {
      setErrorMsg(e.message || '网络错误');
    }
    setLoading(false);
  };

  return (
    <Modal
      open={open}
      size='mini'
      closeOnDimmerClick={false}
      closeOnDocumentClick={false}
      closeOnEscape={false}
      onClose={() => {}}
    >
      <Modal.Header>
        <Icon name='lock' />
        首次登录请修改密码
      </Modal.Header>
      <Modal.Content>
        {errorMsg && (
          <Message negative>
            <Icon name='warning sign' />
            {errorMsg}
          </Message>
        )}
        <Message info>
          检测到您使用的是初始密码，为了账号安全，请先修改密码后再使用系统。
        </Message>
        <Form size='large'>
          <Form.Input
            fluid
            icon='lock'
            iconPosition='left'
            placeholder='新密码（至少 8 位）'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Form.Input
            fluid
            icon='lock'
            iconPosition='left'
            placeholder='确认新密码'
            type='password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button positive loading={loading} onClick={submit}>
          <Icon name='checkmark' />
          确认修改
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ForceResetPasswordModal;
