import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../context/User';
import { StatusContext } from '../context/Status';

import { API, getLogo, getSystemName, isAdmin, isMobile as checkIsMobile, showError } from '../helpers';
import '../index.css';

import {
  IconCalendarClock,
  IconCreditCard,
  IconGift,
  IconHistogram,
  IconHome,
  IconImage,
  IconKey,
  IconLayers,
  IconSetting,
  IconUser,
  IconClose,
} from '@douyinfe/semi-icons';
import { Layout, Nav, SideSheet } from '@douyinfe/semi-ui';

const SiderBar = ({ visible = false, onClose = () => {}, isMobile = false }) => {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const defaultIsCollapsed = checkIsMobile() || localStorage.getItem('default_collapse_sidebar') === 'true';

  let navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState(['home']);
  const systemName = getSystemName();
  const logo = getLogo();
  const [isCollapsed, setIsCollapsed] = useState(defaultIsCollapsed);

  const headerButtons = useMemo(() => [
    {
      text: '首页',
      itemKey: 'home',
      to: '/',
      icon: <IconHome />
    },
    {
      text: '渠道',
      itemKey: 'channel',
      to: '/channel',
      icon: <IconLayers />,
      className: isAdmin() ? 'semi-navigation-item-normal' : 'tableHiddle'
    },
    {
      text: '令牌',
      itemKey: 'token',
      to: '/token',
      icon: <IconKey />
    },
    {
      text: '兑换',
      itemKey: 'redemption',
      to: '/redemption',
      icon: <IconGift />,
      className: isAdmin() ? 'semi-navigation-item-normal' : 'tableHiddle'
    },
    {
      text: '充值',
      itemKey: 'topup',
      to: '/topup',
      icon: <IconCreditCard />
    },
    {
      text: '用户',
      itemKey: 'user',
      to: '/user',
      icon: <IconUser />,
      className: isAdmin() ? 'semi-navigation-item-normal' : 'tableHiddle'
    },
    {
      text: '日志',
      itemKey: 'log',
      to: '/log',
      icon: <IconHistogram />
    },
    {
      text: '数据看板',
      itemKey: 'detail',
      to: '/detail',
      icon: <IconCalendarClock />,
      className: 'semi-navigation-item-normal'
    },
    {
      text: '绘图',
      itemKey: 'midjourney',
      to: '/midjourney',
      icon: <IconImage />,
      className: localStorage.getItem('enable_drawing') === 'true' ? 'semi-navigation-item-normal' : 'tableHiddle'
    },
    {
      text: '设置',
      itemKey: 'setting',
      to: '/setting',
      icon: <IconSetting />
    }
  ], [localStorage.getItem('enable_drawing'), isAdmin()]);

  const loadStatus = async () => {
    const res = await API.get('/api/status');
    const { success, data } = res.data;
    if (success) {
      localStorage.setItem('status', JSON.stringify(data));
      statusDispatch({ type: 'set', payload: data });
      localStorage.setItem('system_name', data.system_name);
      localStorage.setItem('logo', data.logo);
      localStorage.setItem('footer_html', data.footer_html);
      localStorage.setItem('quota_per_unit', data.quota_per_unit);
      localStorage.setItem('display_in_currency', data.display_in_currency);
      localStorage.setItem('enable_drawing', data.enable_drawing);
      localStorage.setItem('enable_data_export', data.enable_data_export);
      localStorage.setItem('data_export_default_time', data.data_export_default_time);
      localStorage.setItem('default_collapse_sidebar', data.default_collapse_sidebar);
      localStorage.setItem('mj_notify_enabled', data.mj_notify_enabled);
    } else {
      showError('无法正常连接至服务器！');
    }
  };

  useEffect(() => {
    loadStatus().then(() => {
      setIsCollapsed(checkIsMobile() || localStorage.getItem('default_collapse_sidebar') === 'true');
    });
  }, []);

  // 移动端导航点击后关闭抽屉
  const handleNavSelect = (key) => {
    setSelectedKeys([key.itemKey]);
    if (isMobile && onClose) {
      // 延迟关闭，让路由跳转先执行
      setTimeout(() => onClose(), 150);
    }
  };

  const navContent = (
    <Nav
      style={{ maxWidth: isMobile ? 280 : 200, height: '100%' }}
      defaultIsCollapsed={checkIsMobile() || localStorage.getItem('default_collapse_sidebar') === 'true'}
      isCollapsed={isMobile ? false : isCollapsed}
      onCollapseChange={collapsed => {
        setIsCollapsed(collapsed);
      }}
      selectedKeys={selectedKeys}
      renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
        const routerMap = {
          home: '/',
          channel: '/channel',
          token: '/token',
          redemption: '/redemption',
          topup: '/topup',
          user: '/user',
          log: '/log',
          midjourney: '/midjourney',
          setting: '/setting',
          about: '/about',
          detail: '/detail'
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
      items={headerButtons}
      onSelect={handleNavSelect}
      // 移动端 SideSheet 头部已显示 logo 和系统名，Nav 不再重复显示
      header={isMobile ? null : {
        logo: <img src={logo} alt="logo" style={{ marginRight: '0.75em', maxHeight: 32 }} />,
        text: systemName
      }}
    >
      {!isMobile && (
        <Nav.Footer collapseButton={true}>
        </Nav.Footer>
      )}
    </Nav>
  );

  // 移动端：SideSheet 抽屉式导航
  if (isMobile) {
    return (
      <SideSheet
        title={null}
        visible={visible}
        onCancel={onClose}
        placement="left"
        width={280}
        closeOnEsc={true}
        maskClosable={true}
        bodyStyle={{ padding: 0 }}
        headerStyle={{ display: 'none' }}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 抽屉头部：logo + 关闭按钮 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--semi-color-border)',
            minHeight: 56,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <img src={logo} alt="logo" style={{ height: 28, width: 28, objectFit: 'contain' }} />
              <span style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {systemName}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="关闭菜单"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--semi-color-text-1)',
              }}
            >
              <IconClose size="large" />
            </button>
          </div>
          {/* 导航内容 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {navContent}
          </div>
        </div>
      </SideSheet>
    );
  }

  // 桌面端：固定侧边栏
  return (
    <>
      <Layout>
        <div style={{ height: '100%' }}>
          {navContent}
        </div>
      </Layout>
    </>
  );
};

export default SiderBar;
