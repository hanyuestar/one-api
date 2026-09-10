import { useState, useEffect, useCallback } from 'react';

/**
 * 响应式布局断点
 * 注意：JS 判断口径必须与 index.css 的媒体查询完全一致，否则临界点布局错乱：
 *   - CSS 移动端: @media (max-width: 768px)  => 宽度 <= 768 为移动端
 *   - CSS 平板:   @media (min-width: 769px) and (max-width: 991px)
 *   - helpers/utils.js 的 isMobile() 同为 window.innerWidth <= 768
 * 区间划分：
 * - 手机: <= 768px
 * - 平板: 769-991px
 * - 桌面: >= 992px
 */
export const BREAKPOINTS = {
  xs: 576,
  sm: 768,   // <= sm 为移动端（含 768，与 CSS max-width:768px 对齐）
  md: 992,   // >= md 为桌面端
  lg: 1200,
};

/**
 * 响应式 Hook，监听窗口尺寸变化并返回当前设备类型。
 * @returns {{ isMobile: boolean, isTablet: boolean, isDesktop: boolean, width: number, height: number }}
 */
export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    let timeoutId = null;
    const handleResize = () => {
      // 防抖，避免频繁触发
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // 与 CSS 媒体查询口径一致：<=768 移动，769-991 平板，>=992 桌面
  const isMobile = windowSize.width <= BREAKPOINTS.sm;
  const isTablet = windowSize.width > BREAKPOINTS.sm && windowSize.width < BREAKPOINTS.md;
  const isDesktop = windowSize.width >= BREAKPOINTS.md;

  return {
    isMobile,
    isTablet,
    isDesktop,
    width: windowSize.width,
    height: windowSize.height,
  };
}

/**
 * 获取响应式内容区 padding。
 * @param {boolean} isMobile
 * @param {boolean} isTablet
 * @returns {string} CSS padding 值
 */
export function getContentPadding(isMobile, isTablet) {
  if (isMobile) return '12px';
  if (isTablet) return '16px';
  return '24px';
}

/**
 * 移动端专用 Hook：管理侧边栏抽屉的显示状态。
 * @returns {{ sidebarVisible: boolean, showSidebar: function, hideSidebar: function, toggleSidebar: function }}
 */
export function useMobileSidebar() {
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const showSidebar = useCallback(() => setSidebarVisible(true), []);
  const hideSidebar = useCallback(() => setSidebarVisible(false), []);
  const toggleSidebar = useCallback(() => setSidebarVisible((v) => !v), []);

  return { sidebarVisible, showSidebar, hideSidebar, toggleSidebar };
}

export default useResponsive;
