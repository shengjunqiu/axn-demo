/**
 * 电脑端一期门户入口：高保真还原门户模块卡样式，最右侧「安小能」点击直达 /assistant。
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Link2,
  Share2,
  Shield,
  Sparkles,
} from 'lucide-react';
import { NAV_PATH } from '@/components/nav/navRoutes';
import './desktop-portal.css';

type PortalModule = {
  id: string;
  title: string;
  path: string;
  icon: ReactNode;
};

function HexIcon({ children }: { children: ReactNode }) {
  return (
    <span className="axn-portal-card-hex" aria-hidden>
      <svg className="axn-portal-hex-shape" viewBox="0 0 100 100" focusable="false">
        <polygon
          points="50,3 93,26.5 93,73.5 50,97 7,73.5 7,26.5"
          fill="rgba(12, 40, 92, 0.94)"
          stroke="rgba(110, 190, 255, 0.72)"
          strokeWidth="1.6"
        />
      </svg>
      <span className="axn-portal-hex-icon">{children}</span>
    </span>
  );
}

const MODULES: PortalModule[] = [
  {
    id: 'business',
    title: '综合业务系统',
    path: '/phase1/business',
    icon: <Link2 size={28} strokeWidth={1.5} />,
  },
  {
    id: 'coordination',
    title: '综合协调保障系统',
    path: '/phase1/coordination',
    icon: <Share2 size={28} strokeWidth={1.5} />,
  },
  {
    id: 'map',
    title: '辅助决策一张图',
    path: '/events',
    icon: <Compass size={28} strokeWidth={1.5} />,
  },
  {
    id: 'mobile',
    title: '移动应用子系统',
    path: '/mobile',
    icon: <Shield size={28} strokeWidth={1.5} />,
  },
  {
    id: 'axn',
    title: '安小能',
    path: NAV_PATH.assistant,
    icon: <Sparkles size={28} strokeWidth={1.5} />,
  },
];

export default function DesktopPortalHost() {
  const navigate = useNavigate();

  return (
    <div className="axn-portal-host" data-testid="desktop-portal-host">
      <div className="axn-portal-bg" aria-hidden />
      <div className="axn-portal-veil" aria-hidden />

      <main className="axn-portal-main">
        <div className="axn-portal-grid" role="list">
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              type="button"
              role="listitem"
              className={`axn-portal-card${mod.id === 'axn' ? ' is-primary' : ''}`}
              data-testid={`portal-module-${mod.id}`}
              onClick={() => navigate(mod.path)}
            >
              <span className="axn-portal-card-accent" aria-hidden />
              <span className="axn-portal-card-title">{mod.title}</span>
              <HexIcon>{mod.icon}</HexIcon>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
