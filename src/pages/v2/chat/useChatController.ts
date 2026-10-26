import { useEffect, useRef, useState } from 'react'
import { EVENT_NAME, isChatPage, type V2PageId } from '../constants'
import { clone } from '../logic/clone'
import { CHAT_PLACEHOLDER, VOICE_SAMPLE, buildChatContext } from './chatContext'
import { applyTransfer, createEngineSession, reply, welcome } from './conversationEngine'
import type { ChatContext, ChatResult, DynamicTransfer, EngineReply, EngineSession } from './types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  results: ChatResult[]
}

interface Session {
  context: ChatContext
  engine: EngineSession
  messages: ChatMessage[]
  suggestions: string[]
  draft: string
}

interface PendingSend {
  token: number
  session: Session
}

const PAGE_SWITCH_NOTE = '页面已切换，本次处理已停止；返回本会话可重新发送。'
const STOP_NOTE = '本次处理已停止，可重新发送需求。'

function sessionKey(context: ChatContext): string {
  return JSON.stringify([context.event, context.page, context.document.name])
}

function accept(session: Session, response: Pick<EngineReply, 'text' | 'results' | 'suggestions'>) {
  session.messages.push({
    role: 'assistant',
    text: response.text || '暂时无法生成建议，请补充需求后重试。',
    results: clone(response.results || []),
  })
  session.suggestions = clone((response.suggestions || []).slice(0, 3))
}

export function useChatController(page: V2PageId, enabled: boolean, onNavigate: (next: V2PageId) => void) {
  const sessionsRef = useRef(new Map<string, Session>())
  const currentRef = useRef<Session | null>(null)
  const pendingRef = useRef<PendingSend | null>(null)
  const revisionRef = useRef(0)
  const visibleRef = useRef(false)
  const draftRef = useRef('')
  const listeningRef = useRef(false)
  const transferRef = useRef<DynamicTransfer | null>(null)
  const navigateRef = useRef(onNavigate)
  navigateRef.current = onNavigate

  const [visible, setVisible] = useState(false)
  const [launcherVisible, setLauncherVisible] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [draft, setDraftState] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const [listening, setListening] = useState(false)
  const [labels, setLabels] = useState({ event: EVENT_NAME, page: '' })

  const publish = () => {
    const session = currentRef.current
    if (!session) return
    setMessages(session.messages.map(message => ({ ...message, results: [...message.results] })))
    setSuggestions([...session.suggestions])
    setLabels({ event: session.context.event, page: session.context.breadcrumb })
  }

  const updateDraft = (value: string) => {
    draftRef.current = value
    setDraftState(value)
    if (currentRef.current) currentRef.current.draft = value
  }

  const stopVoice = () => {
    listeningRef.current = false
    setListening(false)
  }

  const cancelPending = (note?: string) => {
    revisionRef.current += 1
    const current = pendingRef.current
    pendingRef.current = null
    setPending(false)
    if (current && note) current.session.messages.push({ role: 'assistant', text: note, results: [] })
  }

  const switchSession = (context: ChatContext) => {
    const id = sessionKey(context)
    let session = sessionsRef.current.get(id)
    if (!session) {
      const engine = createEngineSession(context)
      session = { context, engine, messages: [], suggestions: [], draft: '' }
      accept(session, welcome(engine))
      sessionsRef.current.set(id, session)
    }
    session.context = context
    session.engine.context = context
    currentRef.current = session
    updateDraft(session.draft)
    publish()
  }

  useEffect(() => {
    stopVoice()
    cancelPending(PAGE_SWITCH_NOTE)
    if (!enabled || !isChatPage(page)) {
      visibleRef.current = false
      setVisible(false)
      setLauncherVisible(false)
      setStatus('')
      return
    }
    const context = buildChatContext(page)
    if (visibleRef.current) {
      switchSession(context)
      const update = transferRef.current
      const session = currentRef.current
      if (update && page === 'plan' && session) {
        transferRef.current = null
        try {
          const acknowledgment = applyTransfer(session.engine, clone(update))
          accept(session, { text: acknowledgment.text, results: [], suggestions: acknowledgment.suggestions })
          publish()
        } catch {
          setStatus('建议未能带入当前会话，请重试。')
        }
      }
      setLauncherVisible(false)
    } else {
      currentRef.current = null
      setLauncherVisible(true)
      setStatus('')
    }
  }, [page, enabled])

  const open = () => {
    if (!enabled || !isChatPage(page)) return
    stopVoice()
    cancelPending('本次处理已停止，可返回本会话重新发送需求。')
    visibleRef.current = true
    setVisible(true)
    setLauncherVisible(false)
    setStatus('')
    switchSession(buildChatContext(page))
  }

  const close = () => {
    stopVoice()
    cancelPending(STOP_NOTE)
    visibleRef.current = false
    setVisible(false)
    setLauncherVisible(enabled && isChatPage(page))
    if (currentRef.current) publish()
  }

  const send = (override?: string) => {
    const session = currentRef.current
    if (!visibleRef.current || !session || pendingRef.current) return
    const raw = override ?? draftRef.current
    const text = raw.trim()
    if (!text) return
    if (raw.length > 4000) {
      setStatus('消息最多 4000 字，请缩短后发送。')
      return
    }
    stopVoice()
    setStatus('')
    session.messages.push({ role: 'user', text, results: [] })
    updateDraft('')
    const token = revisionRef.current + 1
    revisionRef.current = token
    pendingRef.current = { token, session }
    setPending(true)
    publish()
    window.setTimeout(() => {
      if (!pendingRef.current || revisionRef.current !== token || currentRef.current !== session || !visibleRef.current) return
      let response: EngineReply
      try {
        response = reply(session.engine, text)
      } catch {
        response = { text: '本次建议未生成，请重新发送或补充需求。', results: [], suggestions: [] }
      }
      if (!pendingRef.current || revisionRef.current !== token || currentRef.current !== session || !visibleRef.current) return
      pendingRef.current = null
      setPending(false)
      accept(session, response)
      publish()
      if (!response.transfer) return
      try {
        if (response.transfer.event !== EVENT_NAME || response.transfer.baselineId !== 'initial-page-plan') {
          throw new Error('动态更新与当前事件基准不一致，未带入。')
        }
        transferRef.current = clone(response.transfer)
        navigateRef.current('plan')
      } catch {
        accept(session, { text: '建议未带入目标会话，请重新尝试。', results: [], suggestions: [] })
        if (currentRef.current === session) publish()
      }
    }, 400)
  }

  const newConversation = () => {
    if (!currentRef.current || !isChatPage(page)) return
    stopVoice()
    cancelPending()
    sessionsRef.current.delete(sessionKey(buildChatContext(page)))
    currentRef.current = null
    updateDraft('')
    setStatus('')
    switchSession(buildChatContext(page))
  }

  const toggleVoice = () => {
    if (!isChatPage(page)) return
    if (!listeningRef.current) {
      listeningRef.current = true
      setListening(true)
      setStatus('模拟录音中，再次点击结束；不调用麦克风')
      return
    }
    listeningRef.current = false
    setListening(false)
    const sample = currentRef.current?.suggestions[0] || VOICE_SAMPLE[page]
    const existing = draftRef.current
    updateDraft(`${existing}${existing && !/\s$/.test(existing) ? ' ' : ''}${sample}`)
    setStatus('模拟转写已填入，请确认后发送（未采集真实语音）')
  }

  const placeholder = isChatPage(page) ? CHAT_PLACEHOLDER[page] : '说说你希望处理的业务需求'

  return {
    visible,
    launcherVisible,
    messages,
    suggestions,
    draft,
    pending,
    status,
    listening,
    labels,
    placeholder,
    setStatus,
    updateDraft,
    open,
    close,
    send,
    newConversation,
    toggleVoice,
  }
}
