import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import HeaderBar from './components/HeaderBar';
import Footer from './components/Footer';
import 'semantic-ui-css/semantic.min.css';
import './index.css';
import {UserProvider} from './context/User';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {StatusProvider} from './context/Status';
import {Layout} from "@douyinfe/semi-ui";
import SiderBar from "./components/SiderBar";
import { useResponsive, useMobileSidebar, getContentPadding } from './hooks/useResponsive';

// initialization
initVChartSemiTheme({
    isWatchingThemeSwitch: true,
});

const RootLayout = () => {
    const { isMobile, isTablet } = useResponsive();
    const { sidebarVisible, showSidebar, hideSidebar } = useMobileSidebar();
    const contentPadding = getContentPadding(isMobile, isTablet);

    const {Sider, Content, Header} = Layout;

    return (
        <Layout className="app-layout">
            {/* 桌面端：固定侧边栏；移动端：抽屉式导航（由 SiderBar 内部处理） */}
            {!isMobile && (
                <Sider className="app-sider">
                    <SiderBar />
                </Sider>
            )}
            {/* 移动端抽屉导航 */}
            {isMobile && (
                <SiderBar
                    visible={sidebarVisible}
                    onClose={hideSidebar}
                    isMobile={true}
                />
            )}
            <Layout className="app-main-layout">
                <Header className="app-header">
                    <HeaderBar
                        isMobile={isMobile}
                        onMenuClick={showSidebar}
                    />
                </Header>
                <Content
                    className="app-content"
                    style={{
                        padding: contentPadding,
                    }}
                >
                    <App/>
                </Content>
                <Layout.Footer className="app-footer">
                    <Footer></Footer>
                </Layout.Footer>
            </Layout>
            <ToastContainer/>
        </Layout>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <StatusProvider>
            <UserProvider>
                <BrowserRouter>
                    <RootLayout />
                </BrowserRouter>
            </UserProvider>
        </StatusProvider>
    </React.StrictMode>
);
