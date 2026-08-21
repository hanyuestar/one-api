import React, { useContext, useEffect, useState } from 'react';
import { Modal, Form, Toast, Banner } from '@douyinfe/semi-ui';
import { IconLock } from '@douyinfe/semi-icons';
import { API } from '../helpers';
import { UserContext } from '../context/User';

const ForceResetPasswordModal = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formApi, setFormApi] = useState(null);

  useEffect(() => {
    if (userState?.user && userState.user.force_reset) {
      setVisible(true);
    }
  }, [userState]);

  if (!userState?.user || !userState.user.force_reset) {
    return null;
  }

  const submit = async () => {
    if (!formApi) return;
    const values = await formApi.validate();
    const { password, confirmPassword } = values;
    if (password.length < 8) {
      Toast.error('密码长度至少 8 位');
      return;
    }
    if (password !== confirmPassword) {
      Toast.error('两次输入的密码不一致');
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
        Toast.success('密码修改成功');
        const updatedUser = { ...userState.user, force_reset: false };
        userDispatch({ type: 'login', payload: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setVisible(false);
      } else {
        Toast.error(message || '修改失败');
      }
    } catch (e) {
      Toast.error(e.message || '网络错误');
    }
    setLoading(false);
  };

  return (
    <Modal
      title={
        <span>
          <IconLock /> 首次登录请修改密码
        </span>
      }
      visible={visible}
      onOk={submit}
      confirmLoading={loading}
      okText='确认修改'
      closable={false}
      maskClosable={false}
      closeOnEsc={false}
      cancelButtonProps={{ style: { display: 'none' } }}
    >
      <Banner
        type='info'
        description='检测到您使用的是初始密码，为了账号安全，请先修改密码后再使用系统。'
        style={{ marginBottom: 16 }}
      />
      <Form getFormApi={setFormApi} labelPosition='inset'>
        <Form.Input
          field='password'
          label='新密码（至少 8 位）'
          mode='password'
          rules={[{ required: true, message: '请输入新密码' }]}
        />
        <Form.Input
          field='confirmPassword'
          label='确认新密码'
          mode='password'
          rules={[{ required: true, message: '请再次输入新密码' }]}
        />
      </Form>
    </Modal>
  );
};

export default ForceResetPasswordModal;
