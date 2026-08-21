import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { API } from 'utils/api';
import { LOGIN } from 'store/actions';
import { showSuccess } from 'utils/common';

const ForceResetPasswordDialog = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.account?.user);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user || !user.force_reset) {
    return null;
  }

  const submit = async () => {
    setError('');
    if (password.length < 8) {
      setError('密码长度至少 8 位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await API.put('/api/user/self', {
        username: user.username,
        password,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess('密码修改成功');
        const updatedUser = { ...user, force_reset: false };
        dispatch({ type: LOGIN, payload: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        setError(message || '修改失败');
      }
    } catch (e) {
      setError(e.message || '网络错误');
    }
    setLoading(false);
  };

  return (
    <Dialog open={true} maxWidth='xs' fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon color='primary' />
        首次登录请修改密码
      </DialogTitle>
      <DialogContent>
        <Alert severity='info' sx={{ mb: 2 }}>
          检测到您使用的是初始密码，为了账号安全，请先修改密码后再使用系统。
        </Alert>
        {error && (
          <Alert severity='error' sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label='新密码（至少 8 位）'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin='normal'
          />
          <TextField
            fullWidth
            label='确认新密码'
            type='password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin='normal'
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant='contained' onClick={submit} disabled={loading}>
          {loading ? '提交中...' : '确认修改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForceResetPasswordDialog;
