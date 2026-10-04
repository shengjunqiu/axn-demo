/**
 * Deep Ocean Blue — 专业深蓝 SaaS 主题（T-005）。
 *
 * 设计原则：
 * - 主色 #1A5CFF：比 antd 默认蓝更深邃，传递权威与冷静（适用于应急指挥场景）
 * - 背景 #F0F3F8：冰蓝灰基底，比纯白更高级、更不刺眼
 * - 文字 #1A2332：深海军蓝，比纯黑更柔和、有层次
 * - 警示 #B45309：深琥珀（antd colorWarning），同时满足正文 4.5:1 与图标 3:1
 * - 阴影色 rgba(15,35,65,…)：偏冷色调，匹配蓝色系
 *
 * 文字色阶（WCAG 2.2 AA 实测：白底 / layout #F0F3F8 底）：
 * ┌────────────────────┬──────────┬──────────────┬──────────────────────────┐
 * │ token              │ 色值     │ 对比度       │ 允许用途                 │
 * ├────────────────────┼──────────┼──────────────┼──────────────────────────┤
 * │ colorText          │ #1A2332  │ 15.78 / 14.19│ 正文、标题（AAA）        │
 * │ colorTextSecondary │ #586680  │  5.79 /  5.21│ 次要文字、元信息（AA）   │
 * │ colorTextTertiary  │ #8A94A6  │  3.06 /  2.75│ 仅图标/禁用态，禁用于正文│
 * └────────────────────┴──────────┴──────────────┴──────────────────────────┘
 * colorTextSecondary 选 #586680 而非 #5F6D85：antd 派生出的各 Alert 浅底中，
 * warningBg #f5ebdc 最苛刻 —— #5F6D85 只有 4.44:1（差 0.06 不达标），#586680 为 4.91:1。
 * 实测 #586680 在全部实际表面均 ≥4.5:1：白 5.79 / layout 5.21 / infoBg 5.07 /
 * warningBg 4.91 / errorBg 5.33 / soft 5.39。
 * 旧值 #6B7B99（4.27:1）与 #9AABBF（2.35:1）均不达标，已替换。
 */
import type { ThemeConfig } from 'antd';

export const themeConfig: ThemeConfig = {
  token: {
    // ── 主色 ──
    colorPrimary: '#1A5CFF',
    colorInfo: '#1A5CFF',
    colorSuccess: '#0F8B5C',
    colorWarning: '#B45309',
    colorError: '#D43B2F',

    // ── 背景与表面 ──
    colorBgLayout: '#F0F3F8',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',

    // ── 文字（手写覆盖 antd 自动衍生的灰色调） ──
    colorText: '#1A2332',
    colorTextSecondary: '#586680',
    colorTextTertiary: '#8A94A6',

    // ── 边框 ──
    colorBorder: '#D6DEED',
    colorBorderSecondary: '#E4EAF5',

    // ── 填充 ──
    colorFillAlter: '#F4F7FC',
    colorFillQuaternary: '#EDF1F8',

    // ── 圆角与字体 ──
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 4,
    fontSize: 14,
    fontFamily:
      "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 56,
      bodyBg: '#F0F3F8',
    },
    Card: { bodyPadding: 14, headerFontSize: 14 },
    Tabs: { horizontalItemPadding: '8px 14px' },
    Table: { cellPaddingBlockSM: 6, cellPaddingInlineSM: 8 },
    Button: {
      primaryShadow: '0 1px 2px rgba(15, 35, 65, .06), 0 2px 8px rgba(26, 92, 255, .24)',
    },
    Input: {
      activeShadow: '0 0 0 2px rgba(26, 92, 255, .14)',
    },
    Modal: {
      marginXXS: 20,
    },
  },
};