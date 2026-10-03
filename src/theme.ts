/**
 * 全局主题 token（T-004）。浅色业务 AI 工作台，克制、可读优先。
 * 视觉决策记录：主色采用应急业务蓝 #1d6ff2；警示色遵循 antd 语义色。
 */
import type { ThemeConfig } from 'antd';

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#1d6ff2',
    colorInfo: '#1d6ff2',
    colorSuccess: '#2e9e5b',
    colorWarning: '#d48806',
    colorError: '#d4380d',
    colorBgLayout: '#f3f5f9',
    colorBgContainer: '#ffffff',
    borderRadius: 8,
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 56,
      bodyBg: '#f3f5f9',
    },
    Card: { bodyPadding: 14, headerFontSize: 14 },
    Tabs: { horizontalItemPadding: '8px 14px' },
    Table: { cellPaddingBlockSM: 6, cellPaddingInlineSM: 8 },
  },
};
