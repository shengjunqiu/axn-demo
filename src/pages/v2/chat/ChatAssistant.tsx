import { isV2AiKind } from '../aiNodes'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import logoUrl from '../assets/aneng-logo.png'
import { copyResult, downloadResult } from './chatExports'
import { SurroundingsAssistant } from './SurroundingsAssistant'
import { useChatController } from './useChatController'
import type { ChatResult } from './types'
import type { V2PageId } from '../constants'

const STORAGE_KEY = 'anx-v2-launcher-position'
const DRAG_THRESHOLD = 6

function fitPoint(point: { x: number; y: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const maxX = Math.max(0, viewport.width - size.width - 8)
  const maxY = Math.max(0, viewport.height - size.height - 8)
  return {
    x: Math.min(maxX, Math.max(Math.min(8, maxX), point.x)),
    y: Math.min(maxY, Math.max(Math.min(8, maxY), point.y)),
  }
}

function readPosition(): { x: number; y: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as { x?: number; y?: number } | null
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return { x: saved.x ?? 0, y: saved.y ?? 0 }
  } catch {
    /* 存储受限时仍可在本次页面拖拽。 */
  }
  return null
}

function Brand({ className, label }: { className: string; label?: string }) {
  return (
    <span className={className} aria-hidden={label ? undefined : true}>
      <img className="chat-brand-image" src={logoUrl} alt={label ?? ''} />
    </span>
  )
}

function ResultCard({ result }: { result: ChatResult }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [downloading, setDownloading] = useState(false)
  return (
    <details className="chat-result" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="chat-result-summary">
        <span className="chat-result-title">{result.title || '建议草稿'}</span>
        {result.recommended ? <span className="chat-result-recommended">推荐</span> : null}
        <span className="chat-result-toggle">{open ? '收起' : '查看内容'}</span>
        {result.paragraphs?.[0] ? <span className="chat-result-preview">{result.paragraphs[0]}</span> : null}
      </summary>
      <div className="chat-result-content">
        {(result.paragraphs || []).map(text => <p key={text}>{text}</p>)}
        {result.table ? (
          <div className="chat-result-table-wrap">
            <table className="chat-result-table">
              <thead><tr>{result.table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
              <tbody>
                {result.table.rows.map((row, index) => (
                  <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {(result.sections || []).map(section => (
          <div key={section.title}>
            <h4>{section.title}</h4>
            {section.paragraphs.map(text => <p key={text}>{text}</p>)}
          </div>
        ))}
        <div className="chat-result-actions">
          <button type="button" className="chat-result-copy" onClick={async () => {
            const copied = await copyResult(result)
            setNote(copied ? '已复制' : '复制失败，请展开内容手动选择复制。')
          }}>复制</button>
          <button type="button" className="chat-result-download" disabled={downloading} onClick={async () => {
            setDownloading(true)
            setNote('正在生成 Word…')
            try {
              await downloadResult(result)
              setNote('已生成 Word，请查看浏览器下载。')
            } catch {
              setNote('Word 下载未完成，请重试。')
            } finally {
              setDownloading(false)
            }
          }}>下载 Word</button>
          <span className="chat-result-action-note" role="status">{note}</span>
        </div>
      </div>
    </details>
  )
}

type ChatAssistantProps = { page: V2PageId; enabled: boolean; onNavigate: (next: V2PageId) => void; reportRequest?: number }

export function ChatAssistant(props: ChatAssistantProps) {
  if (isV2AiKind(props.page)) return <SurroundingsAssistant key={props.page} kind={props.page} enabled={props.enabled} reportRequest={props.reportRequest ?? 0} />
  return <BusinessChatAssistant {...props} />
}

function BusinessChatAssistant({ page, enabled, onNavigate }: ChatAssistantProps) {
  const chat = useChatController(page, enabled, onNavigate)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; width: number; height: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    if (!chat.visible) return
    inputRef.current?.focus()
  }, [chat.visible])

  const closeRef = useRef(chat.close)
  closeRef.current = chat.close
  useEffect(() => {
    if (!chat.visible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        returnFocus.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chat.visible])

  useEffect(() => {
    const scroll = scrollRef.current
    const latest = scroll?.querySelector('.chat-messages')?.lastElementChild
    if (!scroll || !latest) return
    const style = getComputedStyle(scroll)
    const paddingTop = parseFloat(style.paddingTop) || 0
    const paddingBottom = parseFloat(style.paddingBottom) || 0
    const suggestionsHeight = scroll.querySelector('.chat-suggestions')?.getBoundingClientRect().height ?? 0
    const replyHeight = latest.getBoundingClientRect().height
    const last = chat.messages.at(-1)
    const longReply = last?.role === 'assistant' && replyHeight + suggestionsHeight + paddingTop + paddingBottom > scroll.clientHeight
    if (longReply) {
      const replyTop = latest.getBoundingClientRect().top
      const viewportTop = scroll.getBoundingClientRect().top
      scroll.scrollTop = Math.max(0, scroll.scrollTop + replyTop - viewportTop - paddingTop)
    } else {
      scroll.scrollTop = scroll.scrollHeight
    }
  }, [chat.messages, chat.suggestions, chat.pending, chat.visible])

  useEffect(() => {
    if (!chat.launcherVisible) return
    const element = launcherRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const saved = readPosition()
    const point = saved ?? { x: rect.left, y: rect.top }
    setPosition(fitPoint(point, rect, { width: window.innerWidth, height: window.innerHeight }))
  }, [chat.launcherVisible])

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, moved: false }
    suppressClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = drag.current
    if (!gesture || gesture.id !== event.pointerId) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    gesture.moved = true
    setPosition(fitPoint({ x: gesture.left + dx, y: gesture.top + dy }, gesture, { width: window.innerWidth, height: window.innerHeight }))
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = drag.current
    if (!gesture || gesture.id !== event.pointerId) return
    drag.current = null
    if (gesture.moved) {
      suppressClick.current = true
      const rect = event.currentTarget.getBoundingClientRect()
      const next = fitPoint({ x: rect.left, y: rect.top }, rect, { width: window.innerWidth, height: window.innerHeight })
      setPosition(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* 不影响打开对话。 */ }
    }
  }

  const tooLong = chat.draft.length > 4000

  return (
    <>
      {chat.launcherVisible ? (
        <button
          ref={launcherRef}
          id="chat-launcher"
          type="button"
          className={`chat-launcher${drag.current?.moved ? ' chat-launcher-dragging' : ''}`}
          aria-label="打开安小能"
          title="点击打开安小能；按住可拖动"
          style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={event => {
            if (suppressClick.current) {
              event.preventDefault()
              event.stopPropagation()
              suppressClick.current = false
              return
            }
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            chat.open()
          }}
        >
          <Brand className="chat-launcher-avatar" label="中国安能" />
          安小能
        </button>
      ) : null}
      {chat.visible ? (
        <section id="chat-drawer" className="chat-drawer" role="dialog" aria-modal="false" aria-labelledby="chat-title">
          <div className="chat-header">
            <div className="chat-identity">
              <Brand className="chat-avatar" />
              <div className="chat-title-block">
                <h2 id="chat-title">安小能</h2>
                <p>救援业务助手</p>
              </div>
            </div>
            <div className="chat-header-controls">
              <button type="button" className="chat-new" aria-label="新对话" onClick={chat.newConversation}>新对话</button>
              <button type="button" className="chat-close" aria-label="关闭安小能" onClick={() => { chat.close(); returnFocus.current?.focus() }}>×</button>
            </div>
          </div>
          <div className="chat-context">
            <p className="chat-event">{chat.labels.event || '当前救援事件'}</p>
            <p className="chat-page">{chat.labels.page || '当前业务页面'}</p>
          </div>
          <div className="chat-scroll" ref={scrollRef}>
            <div className="chat-messages" role="log" aria-label="与安小能的对话">
              {chat.messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`chat-message chat-message-${message.role}`}>
                  {message.role === 'assistant' ? <Brand className="chat-message-avatar" /> : null}
                  <div className="chat-message-body">
                    <div className="chat-bubble">
                      {message.text.split(/\n\s*\n/).filter(Boolean).map(text => <p key={text}>{text}</p>)}
                    </div>
                    {message.results.map(result => <ResultCard key={result.title} result={result} />)}
                  </div>
                </article>
              ))}
            </div>
            {chat.pending ? <div className="chat-progress" role="status">正在整理本地演示资料…</div> : null}
            <div className="chat-suggestions" aria-label="推荐问题">
              {chat.suggestions.slice(0, 3).map(text => (
                <button key={text} type="button" className="chat-suggestion" disabled={chat.pending} onClick={() => chat.send(text)}>{text}</button>
              ))}
            </div>
          </div>
          <div className="chat-composer">
            <div id="chat-status" className="chat-status" role="status" aria-live="polite">{chat.status}</div>
            <div className="chat-input-box">
              <textarea
                ref={inputRef}
                className="chat-input"
                rows={2}
                placeholder={chat.placeholder}
                aria-label="向安小能发送消息"
                aria-describedby="chat-status chat-input-hint"
                aria-invalid={tooLong}
                value={chat.draft}
                onChange={event => {
                  const value = event.target.value
                  chat.updateDraft(value)
                  const field = event.target
                  field.style.height = 'auto'
                  field.style.height = `${Math.min(132, Math.max(60, field.scrollHeight))}px`
                  if (value.length > 4000) chat.setStatus('消息最多 4000 字，请缩短后发送。')
                  else if (chat.status === '消息最多 4000 字，请缩短后发送。') chat.setStatus('')
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                    event.preventDefault()
                    chat.send()
                  }
                }}
              />
              <div className="chat-input-actions">
                <span id="chat-input-hint" className="chat-input-hint">Enter 发送 · Shift+Enter 换行</span>
                <div className="chat-send-actions">
                  <span className="chat-voice-simulation">语音模拟</span>
                  <button type="button" className={`chat-mic${chat.listening ? ' chat-mic-active' : ''}`} aria-label="语音输入" aria-pressed={chat.listening} title={chat.listening ? '结束模拟语音输入' : '语音输入（模拟）'} onClick={chat.toggleVoice}>🎙</button>
                  <button type="button" className="chat-send" disabled={!chat.draft.trim() || tooLong || chat.pending} onClick={() => chat.send()}>发送</button>
                </div>
              </div>
            </div>
            <div className="chat-disclosure">演示数据·本地规则，未接入真实模型；语音为模拟，未采集真实语音</div>
          </div>
        </section>
      ) : null}
    </>
  )
}
