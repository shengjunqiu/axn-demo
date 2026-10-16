import { useState } from 'react'
import { Button, Drawer } from 'antd'
import { FileText } from 'lucide-react'
import MockDocumentDetail from '@/components/doc/MockDocumentDetail'
import { useMockDocumentStore } from '@/store/mockDocumentStore'
import { richTextToPlain } from '@/services/richText'
import type { MockDocument } from '@/seed/mockDocuments'
import type { SaveMeta } from '@/store/mockDocumentStore'
import type { DraftSection, EmpowermentKind } from '../logic/empowerment'
import '@/components/doc/doc.css'

/** 复用现有公文编辑器，聊天只承载成果入口。编辑保存不自动应用到V2业务页。 */
export default function WorkflowDocument({ kind, title, sections, onSave }: { kind: EmpowermentKind; title: string; sections: DraftSection[]; onSave: (title: string, sections: DraftSection[]) => void }) {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const scope = `v2-workflow-document-${kind}-mingkeng`
  const document = useMockDocumentStore(s => s.libraries[scope]?.documents.find(d => d.id === id))
  const code = kind === 'resources' ? 'GROUP_RECOMMENDATION' : kind === 'plan' ? 'RESCUE_PLAN' : 'WORK_SUMMARY'
  const save = (next: MockDocument, meta?: SaveMeta) => {
    useMockDocumentStore.getState().update(scope, next, meta)
    onSave(next.title, next.sections.map(([heading, body]) => ({ title: heading, body: richTextToPlain(body) })))
  }
  const show = () => {
    if (document) {
      const changed = document.title !== title || JSON.stringify(document.sections.map(([heading, body]) => [heading, richTextToPlain(body)])) !== JSON.stringify(sections.map(s => [s.title, s.body]))
      if (changed) useMockDocumentStore.getState().update(scope, { ...document, title, sections: sections.map(s => [s.title, s.body]) }, { author: { kind: 'ai' } })
    } else {
      const next = useMockDocumentStore.getState().publishAgentMaterial(scope, { code, title, sections: sections.map(s => [s.title, s.body]) })
      if (!next) return
      setId(next.id)
    }
    setOpen(true)
  }
  const close = () => {
    if (document) {
      const working = useMockDocumentStore.getState().libraries[scope]?.working[document.id]
      if (working?.title.trim() && working.sections.every(([h, b]) => h.trim() && richTextToPlain(b).trim())) save(working, { author: { kind: 'user', name: '值班员', role: '文稿编辑' } })
    }
    setOpen(false)
  }
  return <>
    <div className="axn-workflow-document-card" data-testid="v2-official-document-card">
      <FileText size={24} aria-hidden="true" />
      <div><strong>{title}</strong><p>公文草稿 · {sections.length}个章节 · 待审核</p></div>
      <Button onClick={show} aria-label="查看文书">查看文书</Button>
    </div>
    <details className="axn-workflow-document-outline"><summary>查看公文目录</summary><ol>{sections.map(s => <li key={s.title}>{s.title}</li>)}</ol></details>
    <Drawer open={open} placement="right" size="100%" closable={false} onClose={close} styles={{ body: { padding: 0, display: 'flex', overflow: 'hidden' } }}>
      {document ? <MockDocumentDetail scope={scope} document={document} onClose={close} onSave={save} /> : null}
    </Drawer>
  </>
}
