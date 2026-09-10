import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from 'semantic-ui-react';
import { API, showError, sanitizeMarkdown, sanitizeHTML, safeIframeSrc } from '../../helpers';
import { marked } from 'marked';

const About = () => {
  const { t } = useTranslation();
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);

  const displayAbout = async () => {
    // 从 localStorage 读取的缓存也必须净化，防止旧缓存或被污染存储绕过净化
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
      setAbout(t('about.loading_failed'));
    }
    setAboutLoaded(true);
  };

  useEffect(() => {
    displayAbout().then();
  }, []);

  return (
    <>
      {aboutLoaded && about === '' ? (
        <div className='dashboard-container'>
          <Card fluid className='chart-card'>
            <Card.Content>
              <Card.Header className='header'>{t('about.title')}</Card.Header>
              <p>{t('about.description')}</p>
              {t('about.repository')}
              <a href='https://github.com/hanyuestar/one-api'>
                https://github.com/hanyuestar/one-api
              </a>
            </Card.Content>
          </Card>
        </div>
      ) : (
        <>
          {about.startsWith('https://') ? (
            <iframe
              src={safeIframeSrc(about)}
              sandbox='allow-scripts allow-same-origin allow-forms'
              style={{ width: '100%', height: '80vh', border: 'none' }}
            />
          ) : (
            <div className='dashboard-container'>
              <Card fluid className='chart-card'>
                <Card.Content>
                  <div
                    style={{ fontSize: 'larger' }}
                    dangerouslySetInnerHTML={{ __html: about }}
                  ></div>
                </Card.Content>
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default About;
