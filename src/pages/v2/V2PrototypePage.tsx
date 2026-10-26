import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ReportDetail } from './components/ReportDetail'
import { Sidebar } from './components/Sidebar'
import { useScrollActive } from './components/chrome'
import { OPERATOR_NAME, SUPPORT_LINE, findPageMeta, groupIndexFor, isV2Page, type V2PageId } from './constants'
import { V2Workspace } from './pages/V2Workspace'
import './v2.css'

/**
 * 应急救援综合协调保障系统 V2 对话原型。
 * 由 public/V2独立运行包 的静态页面改成独立路由，不进入安小能主壳。
 */
export default function V2PrototypePage() {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const page = isV2Page(params.page) ? params.page : null
  const [expanded, setExpanded] = useState<number[]>(() => {
    const index = page ? groupIndexFor(page) : -1
    return index >= 0 ? [index] : []
  })
  const [aiEnabled, setAiEnabled] = useState(true)
  const [reportId, setReportId] = useState<string | null>(null)
  const [chatTop, setChatTop] = useState(98)

  useScrollActive(page ?? '')

  useEffect(() => {
    if (!page) return
    const index = groupIndexFor(page)
    setExpanded(index >= 0 ? [index] : [])
    const meta = findPageMeta(page)
    const previous = document.title
    document.title = `${meta.title} · 应急救援综合协调保障系统`
    return () => { document.title = previous }
  }, [page])

  useEffect(() => {
    const header = document.querySelector('.v2-app .system-header')
    const measure = () => setChatTop(Math.max(0, header?.getBoundingClientRect().bottom ?? 0))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  if (!page) return <Navigate to="/v2/resources" replace />

  const go = (next: V2PageId) => {
    setReportId(null)
    navigate(`/v2/${next}`)
  }

  return (
    <div className={`v2-app${aiEnabled ? '' : ' original'}${page === 'events' && new URLSearchParams(location.search).has('event') ? ' event-detail-active' : ''}`} style={{ ['--chat-top' as string]: `${chatTop}px` }}>
      <header className="system-header">
        <div className="brand"><span className="brand-mark">N</span><span>应急救援综合协调保障系统</span></div>
        <div className="header-tools">
          <div className="mode-switch" role="group" aria-label="演示模式">
            <button type="button" className={aiEnabled ? '' : 'selected'} aria-pressed={!aiEnabled} onClick={() => setAiEnabled(false)}>一期原型</button>
            <button type="button" className={aiEnabled ? 'selected' : ''} aria-pressed={aiEnabled} onClick={() => setAiEnabled(true)}>对话赋能</button>
          </div>
          <span className="demo-label">V2对话原型</span>
          <span className="avatar">●</span>
          <span>{OPERATOR_NAME}</span>
          <button type="button" className="header-icon" aria-label="展示大屏">▣</button>
          <button type="button" className="header-icon" aria-label="退出系统">⇥</button>
        </div>
      </header>
      <div className="system-layout">
        <Sidebar
          page={page}
          expanded={expanded}
          onToggle={index => setExpanded(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])}
          onNavigate={go}
        />
        <main id="workspace" tabIndex={-1}>
          <V2Workspace page={page} onNavigate={go} onOpenReport={setReportId} aiEnabled={aiEnabled} />
        </main>
      </div>
      <footer>{SUPPORT_LINE}</footer>
      {reportId ? <ReportDetail reportId={reportId} onClose={() => setReportId(null)} /> : null}
    </div>
  )
}
