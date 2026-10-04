import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
// Inter 只提供拉丁字形（数字、英文、代码），中文由 global.css 的 font-family
// 栈回退到系统字体。声明见同目录 fonts.css（已裁掉 5 个用不到的子集）。
import './styles/fonts.css';
import './styles/global.css';
import AppRoot from './App';
import { themeConfig } from './theme';

/**
 * 把 antd 设计 token 注入 :root，作为全应用唯一的颜色来源。
 *
 * 必须挂在 :root 而不是某个组件的根节点：Drawer / Modal 的内容通过 portal 挂到
 * body 下，组件级 CSS 变量到不了那里 —— 这正是 workspace.css、PrintView、
 * VersionDrawer、ResourcePanel 一度只能硬编码颜色（#8a97ac / #666 / #888）的原因；
 * 改用下面的 --axn-* 后，这些字面色值已清零。
 */
type DesignToken = ReturnType<typeof theme.useToken>['token'];

function applyDesignTokenVars(token: DesignToken) {
  const vars: Record<string, string> = {
    '--axn-primary': token.colorPrimary,
    '--axn-primary-bg': token.colorPrimaryBg,
    '--axn-text': token.colorText,
    '--axn-muted': token.colorTextSecondary,
    '--axn-faint': token.colorTextTertiary,
    '--axn-border': token.colorBorderSecondary,
    '--axn-surface': token.colorBgContainer,
    '--axn-canvas': token.colorBgLayout,
    '--axn-soft': token.colorFillAlter,
    '--axn-success': token.colorSuccess,
    '--axn-warning': token.colorWarning,
    '--axn-error': token.colorError,
  };
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
}

function DesignTokenVars() {
  const { token } = theme.useToken();
  useEffect(() => {
    applyDesignTokenVars(token);
  }, [token]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntdApp>
        <DesignTokenVars />
        <AppRoot />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
