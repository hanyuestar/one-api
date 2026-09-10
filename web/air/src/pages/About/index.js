import React, { useEffect, useState } from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { API, showError, sanitizeMarkdown, sanitizeHTML, safeIframeSrc } from '../../helpers';
import { marked } from 'marked';

const About = () => {
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);

  const displayAbout = async () => {
    // 从 localStorage 读取的缓存也必须净化，防止旧缓存或被污染的存储绕过净化
    const cached = localStorage.getItem('about');
    if (cached) {
      setAbout(cached.startsWith('https://') ? cached : sanitizeHTML(cached));
    }
    const res = await API.get('/api/about');
    const { success, message, data } = res.data;
    if (success) {
      let aboutContent = data;
      if (!data.startsWith('https://')) {
        aboutContent = sanitizeMarkdown(marked.parse(data));
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
              src={safeIframeSrc(about)}
              style={{ width: '100%', height: '80vh', border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-forms"
            /> : <div style={{ fontSize: 'larger' }} dangerouslySetInnerHTML={{ __html: about }}></div>
          }
        </>
      }
    </>
  );
};


export default About;
