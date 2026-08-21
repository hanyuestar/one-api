import React from 'react';
import { Spin } from '@douyinfe/semi-ui';

const Loading = ({ prompt: name = 'page' }) => {
  return (
    <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" tip={`加载${name}中...`} />
    </div>
  );
};

export default Loading;
