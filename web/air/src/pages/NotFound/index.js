import React from 'react';
import { Banner } from '@douyinfe/semi-ui';

const NotFound = () => (
  <div style={{ padding: 24 }}>
    <Banner
      type="danger"
      title="页面不存在"
      description="请检查你的浏览器地址是否正确"
      fullMode={false}
    />
  </div>
);

export default NotFound;
