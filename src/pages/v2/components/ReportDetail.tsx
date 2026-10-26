import { useEffect, useRef } from 'react'
import { findReport, reportBody } from '../logic/dynamicsReports'

export function ReportDetail({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const report = findReport(reportId)
  useEffect(() => { closeRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!report) return null
  return (
    <div className="assist-overlay">
      <div className="assist-backdrop" onClick={onClose} />
      <section className="assist-drawer" role="dialog" aria-modal="true" aria-labelledby="v2-report-title">
        <header className="assist-header">
          <div>
            <span className="assist-demo">演示报告详情</span>
            <h2 id="v2-report-title">{report.title}</h2>
            <p>反馈时间 {report.time}<br />查看原始报告正文，不更改一期列表和附件。</p>
          </div>
          <button ref={closeRef} type="button" className="assist-close" aria-label="关闭辅助面板" onClick={onClose}>×</button>
        </header>
        <div className="assist-body">
          <p className="dynamic-source-note">演示正文：这是为demo编写的原始报告样本，并非截图附件原文，也不是分析前的AI抽取结果。</p>
          <article className="dynamic-document">{reportBody(report.id)}</article>
        </div>
        <footer className="assist-footer">
          <p>上报状态：{report.status}；结构化总结和方案影响在点击汇总分析后查看。</p>
          <button type="button" onClick={onClose}>返回当前页面</button>
        </footer>
      </section>
    </div>
  )
}
