import React, { useEffect, useState } from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import { marked } from 'marked';

const About = () => {
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);

  const displayAbout = async () => {
    setAbout(localStorage.getItem('about') || '');
    const res = await API.get('/api/about');
    const { success, message, data } = res.data;
    if (success) {
      let aboutContent = data;
      if (!data.startsWith('https://')) {
        aboutContent = marked.parse(data);
      }
      setAbout(aboutContent);
      localStorage.setItem('about', aboutContent);
    } else {
      showError(message);
      setAbout('加载关于内容失败...');
    }
    setAboutLoaded(true);
  };

  useEffect(() => {
    displayAbout().then();
  }, []);

  return (
    <>
      {
        aboutLoaded && about === '' ? <>
          <div style={{ padding: 24, background: 'var(--semi-color-bg-1)', borderRadius: 8, border: '1px solid var(--semi-color-border)' }}>
            <Typography.Title heading={3}>关于</Typography.Title>
            <p>可在设置页面设置关于内容，支持 HTML & Markdown</p>
            项目仓库地址：
            <a href='https://github.com/hanyuestar/one-api'>
              https://github.com/hanyuestar/one-api
            </a>
          </div>
        </> : <>
          {
            about.startsWith('https://') ? <iframe
              src={about}
              style={{ width: '100%', height: '100vh', border: 'none' }}
            /> : <div style={{ fontSize: 'larger' }} dangerouslySetInnerHTML={{ __html: about }}></div>
          }
        </>
      }
    </>
  );
};


export default About;
