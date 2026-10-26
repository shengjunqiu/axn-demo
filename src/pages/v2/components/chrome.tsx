import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { EVENT_NAME } from '../constants'

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>
}

export function ActionButton({
  children,
  primary = false,
  small = false,
  danger = false,
  ai = false,
  onClick,
}: {
  children: ReactNode
  primary?: boolean
  small?: boolean
  danger?: boolean
  ai?: boolean
  onClick?: () => void
}) {
  const className = [primary ? 'primary' : '', small ? 'small' : '', danger ? 'danger' : '', ai ? 'ai-button' : ''].filter(Boolean).join(' ')
  return <button type="button" className={className} onClick={onClick}>{children}</button>
}

export function EventBar({ actions }: { actions?: ReactNode }) {
  return (
    <div className="event-bar">
      <div className="event-title"><span className="flag">⚑</span>当前事件：{EVENT_NAME}</div>
      {actions ? <Toolbar>{actions}</Toolbar> : null}
    </div>
  )
}

export function SectionHeader({ title, actions, className = '' }: { title: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={`section-header ${className}`.trim()}>
      <h1 className="page-heading">{title}</h1>
      {actions ? <Toolbar>{actions}</Toolbar> : null}
    </div>
  )
}

export function DataTable({
  headers,
  rows,
  striped = true,
  tableClassName = '',
}: {
  headers: string[]
  rows: ReactNode[][]
  striped?: boolean
  tableClassName?: string
}) {
  return (
    <div className="table-wrap">
      <table className={`data-table${striped ? ' striped' : ''} ${tableClassName}`.trim()}>
        <thead>
          <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyTable({ headers, message = '无数据' }: { headers: string[]; message?: string }) {
  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
          </thead>
        </table>
      </div>
      <div className="empty-state"><div className="empty-icon">▱</div>{message}</div>
    </>
  )
}

export function Pagination({ total, pages = 1 }: { total: number; pages?: number }) {
  const pageButtons = Math.min(pages, 7)
  return (
    <div className="pagination">
      <span>共 {total} 条</span>
      <button type="button">上一页</button>
      <button type="button" className="selected">1</button>
      {Array.from({ length: pageButtons - 1 }, (_, index) => <button type="button" key={index + 2}>{index + 2}</button>)}
      {pages > 7 ? <><span>…</span><button type="button">{pages}</button></> : null}
      <button type="button">下一页</button>
      <select aria-label="每页条数" defaultValue="10"><option value="10">10 / 页</option></select>
      <span>到</span>
      <input aria-label="页码" defaultValue="1" />
      <span>页</span>
    </div>
  )
}

export function Tabs({ names, variant = '', activeIndex, onChange }: { names: string[]; variant?: '' | 'flat' | 'pills'; activeIndex?: number; onChange?: (index: number) => void }) {
  const [localActive, setActive] = useState(0)
  const active = activeIndex ?? localActive
  return (
    <div className={`tabs ${variant}`.trim()} role="tablist">
      {names.map((name, index) => (
        <button key={name} type="button" role="tab" aria-selected={index === active} className={index === active ? 'active' : ''} onClick={() => { setActive(index); onChange?.(index) }}>{name}</button>
      ))}
    </div>
  )
}

export function PaperTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <table>
      <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

export function PaperViewer({ children, pageCount = 4 }: { children: ReactNode; pageCount?: number }) {
  return (
    <div className="doc-area">
      <div className="doc-scroller">
        <article className="paper">{children}</article>
      </div>
      <div className="viewer-bar">
        <span>{`页码：1\u3000页面：1/${pageCount}`}</span>
        <span className="viewer-tools"><span>◉</span><span>−</span><span>100%</span><span>＋</span><span>▣</span><span>⛶</span></span>
      </div>
    </div>
  )
}

export function SelectBox() {
  return <input type="checkbox" aria-label="选择此项" />
}

export function CellActions({ labels }: { labels: string[] }) {
  return (
    <div className="cell-actions">
      {labels.map(label => <ActionButton key={label} small danger={label === '删除'}>{label}</ActionButton>)}
    </div>
  )
}

export function useScrollActive(pageKey: string) {
  const frame = useRef(0)
  useEffect(() => {
    frame.current = window.requestAnimationFrame(() => {
      document.querySelector('.v2-app .nav-child.active, .v2-app .nav-top.active')?.scrollIntoView({ block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame.current)
  }, [pageKey])
}
