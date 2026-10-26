/**
 * 手机端演示页：在苹果手机边框内嵌套展示「工作台」入口页。
 * 边框内为 /mobile-workbench（含悬浮安小能），可展开聊天或进入 /assistant。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { NAV_PATH } from '@/components/nav/navRoutes';
import './mobile-preview.css';

/** iPhone 15/16 逻辑分辨率量级（CSS px）。 */
const SCREEN_W = 390;
const SCREEN_H = 844;
/** 外框状态栏（含灵动岛）高度，内容从下方开始。 */
const STATUS_H = 54;
/** 底部 Home 指示条预留，避免挡住输入区。 */
const HOME_H = 22;

export default function MobileAssistantPreview() {
  const iframeSrc = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#/mobile-workbench?phonePreview=1`;
  }, []);

  const frameH = SCREEN_H - STATUS_H - HOME_H;

  return (
    <div className="axn-mobile-preview" data-testid="mobile-assistant-preview">
      <header className="axn-mobile-preview-bar">
        <div>
          <h1 className="axn-mobile-preview-title">安小能 · 手机工作台预览</h1>
          <p className="axn-mobile-preview-desc">边框内为手机工作台；点「常用应用」中的安小能直接进入对话页（模拟）</p>
        </div>
        <Link className="axn-mobile-preview-back" to={NAV_PATH.assistant}>
          返回桌面端
        </Link>
      </header>

      <div className="axn-mobile-preview-stage">
        <div className="axn-iphone" aria-label="iPhone 演示边框">
          <div className="axn-iphone-btn axn-iphone-btn--silent" aria-hidden="true" />
          <div className="axn-iphone-btn axn-iphone-btn--vol-up" aria-hidden="true" />
          <div className="axn-iphone-btn axn-iphone-btn--vol-down" aria-hidden="true" />
          <div className="axn-iphone-btn axn-iphone-btn--power" aria-hidden="true" />

          <div className="axn-iphone-bezel">
            <div className="axn-iphone-screen" style={{ width: SCREEN_W, height: SCREEN_H }}>
              <div className="axn-iphone-status" style={{ height: STATUS_H }} aria-hidden="true">
                <span className="axn-iphone-status-time">9:41</span>
                <div className="axn-iphone-island">
                  <span className="axn-iphone-island-cam" />
                </div>
                <span className="axn-iphone-status-sys">
                  <i className="axn-iphone-signal" />
                  <i className="axn-iphone-battery" />
                </span>
              </div>

              <iframe
                className="axn-iphone-frame"
                title="安小能助手（手机端）"
                src={iframeSrc}
                width={SCREEN_W}
                height={frameH}
              />

              <div className="axn-iphone-home-slot" style={{ height: HOME_H }} aria-hidden="true">
                <div className="axn-iphone-home" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
