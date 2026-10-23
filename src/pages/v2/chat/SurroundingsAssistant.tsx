import type { V2AiKind } from '../aiNodes'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { X } from 'lucide-react'
import './surroundings-assistant.css'
import { RESOURCE_REPORT_READY, RESOURCE_REPORT_REQUEST } from '../surroundingsData'
import { isWorkflowApplication, WORKFLOW_APPLIED } from '../logic/empowerment'
import type { EmpowermentKind, WorkflowApplication } from '../logic/empowerment'

/** 复用真正的助手路由，以独立窄视口呈现手机布局。收起后保留对话。 */
export function SurroundingsAssistant({ enabled, reportRequest, kind = 'surroundings', workflowKind, onApply }: { enabled: boolean; reportRequest: number; kind?: V2AiKind; workflowKind?: EmpowermentKind; onApply?: (data: WorkflowApplication) => void }) {
  const [open, setOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number; height: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ id: number; x: number; y: number; left: number; top: number; width: number; height: number } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const frameCleanup = useRef<(() => void) | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const frameReady = useRef(false)
  const pendingRequest = useRef<string | null>(null)
  const requestPrefix = useRef(crypto.randomUUID())
  const lastRequest = useRef(reportRequest)
  const activeRequest = useRef<string | null>(null)
  const appliedRequests = useRef(new Set<string>())
  const applyRef = useRef(onApply)
  applyRef.current = onApply

  const clamp = (value: number, size: number, viewport: number) => Math.max(8, Math.min(value, Math.max(8, viewport - size - 8)))

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.id) return
    setPosition({
      x: clamp(drag.left + event.clientX - drag.x, drag.width, window.innerWidth),
      y: clamp(drag.top + event.clientY - drag.y, drag.height, window.innerHeight),
      height: drag.height,
    })
  }
  const endDrag = () => { dragRef.current = null; setDragging(false) }

  useEffect(() => {
    if (!enabled || !open) return
    const fit = () => {
      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition(previous => previous ? {
        x: clamp(previous.x, rect.width, window.innerWidth),
        y: clamp(previous.y, rect.height, window.innerHeight), height: previous.height,
      } : null)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [enabled, open])

  const deliver = () => {
    if (!frameReady.current || !pendingRequest.current) return
    activeRequest.current = pendingRequest.current
    frameRef.current?.contentWindow?.postMessage({ type: RESOURCE_REPORT_REQUEST, requestId: pendingRequest.current, kind: workflowKind ?? kind }, window.location.origin)
    pendingRequest.current = null
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      if (isWorkflowApplication(event.data) && event.data.kind === workflowKind && event.data.requestId === activeRequest.current) {
        const key = `${event.data.requestId}:${event.data.savedAt}`
        if (!appliedRequests.current.has(key)) { applyRef.current?.(event.data); appliedRequests.current.add(key) }
        frameRef.current?.contentWindow?.postMessage({ type: WORKFLOW_APPLIED, requestId: event.data.requestId, savedAt: event.data.savedAt }, window.location.origin)
        return
      }
      if (event.data?.type !== RESOURCE_REPORT_READY) return
      frameReady.current = true
      deliver()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const show = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setStarted(true)
    setOpen(true)
  }
  const hide = () => {
    endDrag()
    setOpen(false)
    triggerRef.current?.focus()
  }
  const hideRef = useRef(hide)
  hideRef.current = hide

  useEffect(() => {
    if (enabled && reportRequest > lastRequest.current) {
      lastRequest.current = reportRequest
      pendingRequest.current = `${requestPrefix.current}:${reportRequest}`
      show()
      deliver()
    }
  }, [enabled, reportRequest])

  useEffect(() => {
    if (!open || !enabled) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, enabled])

  useEffect(() => () => frameCleanup.current?.(), [])

  return <>
    {started && <section ref={panelRef} className={`v2-mobile-assistant${dragging ? ' is-dragging' : ''}`} hidden={!enabled || !open} role="dialog" aria-modal="false" aria-label="安小能手机端助手"
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', height: position.height } : undefined}>
      <header className="v2-mobile-assistant-header" title="按住此处拖动窗口"
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
        <span><span className="v2-mobile-assistant-mark" aria-hidden="true">✦</span>安小能</span>
        <button ref={closeRef} type="button" className="v2-mobile-assistant-close" aria-label="收起安小能" onClick={hide}><X size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      </header>
      <iframe
        ref={frameRef}
        title="安小能助手（手机端）"
        src={`${window.location.pathname}#/assistant?embedded=v2-${workflowKind ? `workflow-${workflowKind}` : kind}`}
        onLoad={event => {
          frameCleanup.current?.()
          const frameWindow = event.currentTarget.contentWindow
          if (!frameWindow) return
          const onKey = (key: KeyboardEvent) => {
            if (key.key === 'Escape' && !key.defaultPrevented) hideRef.current()
          }
          frameWindow.addEventListener('keydown', onKey)
          frameCleanup.current = () => frameWindow.removeEventListener('keydown', onKey)
        }}
      />
    </section>}
  </>
}
