import React, { useEffect, useState } from 'react';

import { getFooterHTML, getSystemName, sanitizeHTML } from '../helpers';

const Footer = () => {
  const systemName = getSystemName();
  // 初始值也必须净化，防止 localStorage 被污染时在首次渲染注入未净化 HTML
  const [footer, setFooter] = useState(() => sanitizeHTML(getFooterHTML()));
  let remainCheckTimes = 5;

  const loadFooter = () => {
    let footer_html = localStorage.getItem('footer_html');
    if (footer_html) {
      setFooter(sanitizeHTML(footer_html));
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (remainCheckTimes <= 0) {
        clearInterval(timer);
        return;
      }
      remainCheckTimes--;
      loadFooter();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: '16px 0', textAlign: 'center', borderTop: '1px solid var(--semi-color-border)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {footer ? (
          <div
            className='custom-footer'
            dangerouslySetInnerHTML={{ __html: footer }}
          ></div>
        ) : (
          <div className='custom-footer'>
            <a
              href='https://github.com/hanyuestar/one-api'
              target='_blank'
            >
              {systemName} {process.env.REACT_APP_VERSION}{' '}
            </a>
            由{' '}
            <a href='https://github.com/hanyuestar' target='_blank'>
              hanyuestar
            </a>{' '}
            构建，主题 air 来自{' '}
            <a href='https://github.com/Calcium-Ion' target='_blank'>
              Calon
            </a>{' '}，源代码遵循{' '}
            <a href='https://opensource.org/licenses/mit-license.php'>
              MIT 协议
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Footer;
