import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../context/User';

import { API, getLogo, getSystemName, showSuccess } from '../helpers';
import '../index.css';

import fireworks from 'react-fireworks';

import { IconHelpCircle, IconKey, IconUser, IconMenu } from '@douyinfe/semi-icons';
import { Avatar, Dropdown, Layout, Nav, Switch } from '@douyinfe/semi-ui';
import { stringToColor } from '../helpers/render';

// HeaderBar Buttons
let headerButtons = [
  {
    text: '关于',
    itemKey: 'about',
    to: '/about',
    icon: <IconHelpCircle />
  }
];

const HeaderBar = ({ isMobile = false, onMenuClick = () => {} }) => {
  const [userState, userDispatch] = useContext(UserContext);
  let navigate = useNavigate();

  const [showSidebar, setShowSidebar] = useState(false);
  const [dark, setDark] = useState(false);
  const systemName = getSystemName();
  const logo = getLogo();
  var themeMode = localStorage.getItem('theme-mode');
  const currentDate = new Date();
  // enable fireworks on new year(1.1 and 2.9-2.24)
  const isNewYear = (currentDate.getMonth() === 0 && currentDate.getDate() === 1) || (currentDate.getMonth() === 1 && currentDate.getDate() >= 9 && currentDate.getDate() <= 24);

  async function logout() {
    setShowSidebar(false);
    await API.get('/api/user/logout');
    showSuccess('注销成功!');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    }, 3000);
  };

  useEffect(() => {
    if (themeMode === 'dark') {
      switchMode(true);
    }
  }, []);

  const switchMode = (model) => {
    const body = document.body;
    if (!model) {
      body.removeAttribute('theme-mode');
      localStorage.setItem('theme-mode', 'light');
    } else {
      body.setAttribute('theme-mode', 'dark');
      localStorage.setItem('theme-mode', 'dark');
    }
    setDark(model);
  };

  return (
    <>
      <Layout>
        <div style={{ width: '100%' }} className="header-bar-wrapper">
          <Nav
            mode={'horizontal'}
            renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
              const routerMap = {
                about: '/about',
                login: '/login',
                register: '/register'
              };
              return (
                <Link
                  style={{ textDecoration: 'none' }}
                  to={routerMap[props.itemKey]}
                >
                  {itemElement}
                </Link>
              );
            }}
            selectedKeys={[]}
            onSelect={key => {

            }}
            footer={
              <>
                {/* 移动端：汉堡菜单按钮 */}
                {isMobile && (
                  <button
                    onClick={onMenuClick}
                    aria-label="打开菜单"
                    className="mobile-menu-button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      marginRight: 4,
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--semi-color-text-0)',
                    }}
                  >
                    <IconMenu size="large" />
                  </button>
                )}
                {isNewYear &&
                  <Dropdown
                    position="bottomRight"
                    render={
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={handleNewYearClick}>Happy New Year!!!</Dropdown.Item>
                      </Dropdown.Menu>
                    }
                  >
                    <Nav.Item itemKey={'new-year'} text={'🏮'} />
                  </Dropdown>
                }
                {/* 非移动端显示"关于"导航项；移动端移入抽屉 */}
                {!isMobile && (
                  <Nav.Item itemKey={'about'} icon={<IconHelpCircle />} />
                )}
                {/* 主题切换开关：移动端缩小尺寸 */}
                <Switch
                  checkedText="🌞"
                  size={isMobile ? 'default' : 'large'}
                  checked={dark}
                  uncheckedText="🌙"
                  onChange={switchMode}
                />
                {userState.user ?
                  <>
                    <Dropdown
                      position="bottomRight"
                      render={
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={logout}>退出</Dropdown.Item>
                        </Dropdown.Menu>
                      }
                    >
                      <Avatar size="small" color={stringToColor(userState.user.username)} style={{ margin: 4 }}>
                        {userState.user.username[0]}
                      </Avatar>
                      {/* 移动端隐藏用户名，只显示头像 */}
                      {!isMobile && <span>{userState.user.username}</span>}
                    </Dropdown>
                  </>
                  :
                  <>
                    <Nav.Item itemKey={'login'} text={isMobile ? '' : '登录'} icon={<IconKey />} />
                    <Nav.Item itemKey={'register'} text={isMobile ? '' : '注册'} icon={<IconUser />} />
                  </>
                }
              </>
            }
          >
          </Nav>
        </div>
      </Layout>
    </>
  );
};

export default HeaderBar;
