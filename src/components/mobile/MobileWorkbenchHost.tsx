/**
 * 手机端「工作台」嵌入演示：仿安能通工作台截图布局；
 * 安小能放在「常用应用」中，点击后直接进入 /assistant。
 */
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  CalendarDays,
  CloudSun,
  FilePlus2,
  FileText,
  Grid3X3,
  ListTodo,
  Mail,
  MessageSquare,
  Newspaper,
  Plus,
  Settings,
  Shield,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { NAV_PATH } from '@/components/nav/navRoutes';
import './mobile-workbench.css';

type AppItem = {
  id: string;
  label: string;
  tone: 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'brand';
  icon: ReactNode;
  badge?: string;
  ai?: boolean;
  /** 安小能入口 */
  action?: 'axn';
};

const DOC_APPS: AppItem[] = [
  { id: 'doc-center', label: '公文中心', tone: 'blue', icon: <FileText size={22} /> },
  { id: 'todo', label: '统一待办', tone: 'blue', icon: <ListTodo size={22} /> },
  { id: 'doc-ant', label: '公文中心-安能通', tone: 'blue', icon: <Building2 size={22} /> },
];

const COMMON_APPS: AppItem[] = [
  { id: 'todo2', label: '统一待办', tone: 'blue', icon: <ListTodo size={22} /> },
  { id: 'doc-ant2', label: '公文中心-安能通', tone: 'blue', icon: <Building2 size={22} /> },
  { id: 'finance', label: '财务共享', tone: 'blue', icon: <Wallet size={22} /> },
  { id: 'contract-sys', label: '合同管理系统', tone: 'blue', icon: <Briefcase size={22} /> },
  { id: 'contract', label: '合同管理', tone: 'blue', icon: <FilePlus2 size={22} /> },
  { id: 'travel', label: '差旅管理', tone: 'purple', icon: <Briefcase size={22} /> },
  { id: 'platform', label: '综合平台', tone: 'orange', icon: <Sparkles size={22} />, badge: '9' },
  { id: 'supervisor', label: '监事会平台', tone: 'red', icon: <Shield size={22} /> },
  { id: 'rules', label: '规章制度', tone: 'blue', icon: <FileText size={22} />, ai: true },
  {
    id: 'axn',
    label: '安小能',
    tone: 'brand',
    icon: <span className="axn-mw-letter">安</span>,
    ai: true,
    action: 'axn',
  },
  { id: 'mail', label: '企业邮箱', tone: 'blue', icon: <Mail size={22} /> },
  { id: 'meeting', label: '会议日程-安能通', tone: 'orange', icon: <CalendarDays size={22} /> },
  { id: 'safety', label: '安全生产监管系统', tone: 'teal', icon: <span className="axn-mw-letter">A</span> },
];

const TABS = [
  { id: 'msg', label: '消息', icon: <MessageSquare size={20} /> },
  { id: 'contacts', label: '通讯录', icon: <Users size={20} /> },
  { id: 'workbench', label: '工作台', icon: <Grid3X3 size={20} />, active: true },
  { id: 'news', label: '资讯', icon: <Newspaper size={20} /> },
  { id: 'me', label: '我的', icon: <UserRound size={20} /> },
] as const;

function AppIcon({
  item,
  onClick,
}: {
  item: AppItem;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const className = `axn-mw-app${interactive ? ' axn-mw-app--action' : ''}`;
  const body = (
    <>
      <span className={`axn-mw-app-icon axn-mw-app-icon--${item.tone}`}>
        {item.icon}
        {item.badge ? <i className="axn-mw-badge">{item.badge}</i> : null}
        {item.ai ? <i className="axn-mw-ai">AI</i> : null}
      </span>
      <span className="axn-mw-app-label">{item.label}</span>
    </>
  );
  if (!interactive) {
    return (
      <div className={className} data-testid={`mw-app-${item.id}`}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      data-testid={`mw-app-${item.id}`}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

export default function MobileWorkbenchHost() {
  const navigate = useNavigate();

  return (
    <div className="axn-mw-host" data-testid="mobile-workbench-host">
      <div className="axn-mw-phone">
        <header className="axn-mw-header">
          <div className="axn-mw-header-row">
            <h1 className="axn-mw-title">工作台</h1>
            <div className="axn-mw-header-actions" aria-hidden>
              <Settings size={20} />
              <Plus size={22} />
            </div>
          </div>
          <div className="axn-mw-org">
            <span className="axn-mw-org-name">中国安能建设集团（演示）</span>
            <span className="axn-mw-org-badge">9</span>
          </div>
        </header>

        <main className="axn-mw-main">
          <section className="axn-mw-weather" aria-label="天气（模拟）">
            <div className="axn-mw-weather-left">
              <CloudSun size={28} aria-hidden />
              <div>
                <strong>阴</strong>
                <small>南风 ≤3级</small>
              </div>
            </div>
            <div className="axn-mw-weather-right">
              <span className="axn-mw-temp">22°</span>
              <span className="axn-mw-city">北京市 ▾</span>
            </div>
          </section>

          <section className="axn-mw-card">
            <h2 className="axn-mw-section-title">办文</h2>
            <div className="axn-mw-app-row">
              {DOC_APPS.map((item) => (
                <AppIcon key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="axn-mw-card">
            <h2 className="axn-mw-section-title">常用应用</h2>
            <div className="axn-mw-app-grid">
              {COMMON_APPS.map((item) => (
                <AppIcon
                  key={item.id}
                  item={item}
                  onClick={
                    item.action === 'axn'
                      ? () => navigate(`${NAV_PATH.assistant}?phonePreview=1`)
                      : undefined
                  }
                />
              ))}
            </div>
          </section>

          <p className="axn-mw-hint">以上为手机工作台示意（模拟）；点「常用应用」中的安小能直接进入对话页。</p>
        </main>

        <nav className="axn-mw-tabbar" aria-label="底部导航（模拟）">
          {TABS.map((tab) => (
            <span
              key={tab.id}
              className={`axn-mw-tab${'active' in tab && tab.active ? ' is-active' : ''}`}
            >
              <span className="axn-mw-tab-icon">
                {tab.icon}
                {'active' in tab && tab.active ? <i className="axn-mw-tab-dot" /> : null}
              </span>
              {tab.label}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
