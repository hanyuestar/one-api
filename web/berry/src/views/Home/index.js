import React, { useEffect, useState } from 'react';
import { showError, showNotice } from 'utils/common';
import { sanitizeMarkdown, sanitizeHTML, safeIframeSrc } from 'utils/sanitize';
import { API } from 'utils/api';
import { marked } from 'marked';
import BaseIndex from './baseIndex';
import { Box, Container } from '@mui/material';

const Home = () => {
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const displayNotice = async () => {
    const res = await API.get('/api/notice');
    const { success, message, data } = res.data;
    if (success) {
      let oldNotice = localStorage.getItem('notice');
      if (data !== oldNotice && data !== '') {
        const htmlNotice = sanitizeMarkdown(marked(data));
        showNotice(htmlNotice, true);
        localStorage.setItem('notice', data);
      }
    } else {
      showError(message);
    }
  };

  const displayHomePageContent = async () => {
    // 从 localStorage 读取的缓存也必须净化，防止旧缓存或被污染存储绕过净化
    const cached = localStorage.getItem('home_page_content');
    if (cached) {
      setHomePageContent(cached.startsWith('https://') ? cached : sanitizeHTML(cached));
    }
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = sanitizeMarkdown(marked.parse(data));
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  useEffect(() => {
    displayNotice().then();
    displayHomePageContent().then();
  }, []);

  return (
    <>
      {homePageContentLoaded && homePageContent === '' ? (
        <BaseIndex />
      ) : (
        <>
          <Box>
            {homePageContent.startsWith('https://') ? (
              <iframe
                title="home_page_content"
                src={safeIframeSrc(homePageContent)}
                sandbox="allow-scripts allow-same-origin allow-forms"
                style={{ width: '100%', height: '80vh', border: 'none' }}
              />
            ) : (
              <>
                <Container>
                  <div style={{ fontSize: 'larger' }} dangerouslySetInnerHTML={{ __html: homePageContent }}></div>
                </Container>
              </>
            )}
          </Box>
        </>
      )}
    </>
  );
};

export default Home;
