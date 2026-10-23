import { useState } from 'react'
import { SurroundingsAssistant } from '../chat/SurroundingsAssistant'
import { isEmpowermentKind } from '../logic/empowerment'
import type { EmpowermentKind, WorkflowApplication } from '../logic/empowerment'
import type { V2PageId } from '../constants'
import { DynamicsPage, MapsPage, OrganizationPage, RecordsPage, ResponsePage, TasksPage } from './fieldPages'
import { PlanPage, ResourcesPage, SurroundingsPage, TransportPage } from './paperPages'
import { ApprovalPage, AssemblyPage, BriefsPage, DocumentsPage, EventsPage, ForcesPage, OrdersPage, ReturnPage, SummaryPage, SuppliesPage } from './rosterPages'

export function V2Workspace({
  page,
  onOpenReport,
  aiEnabled = true,
}: {
  page: V2PageId
  onNavigate: (page: V2PageId) => void
  onOpenReport: (id: string) => void
  aiEnabled?: boolean
}) {
  const [applications, setApplications] = useState<Partial<Record<EmpowermentKind, WorkflowApplication>>>({})
  return <WorkspaceContent key={page} page={page} onOpenReport={onOpenReport} aiEnabled={aiEnabled} applied={isEmpowermentKind(page) ? applications[page] : undefined} onApply={data => setApplications(current => ({ ...current, [data.kind]: data }))} />
}

function WorkspaceContent({ page, onOpenReport, aiEnabled, applied, onApply }: { page: V2PageId; onOpenReport: (id: string) => void; aiEnabled: boolean; applied?: WorkflowApplication; onApply: (data: WorkflowApplication) => void }) {
  const [request, setRequest] = useState(0)
  const open = () => aiEnabled ? () => setRequest(v => v + 1) : undefined
  const content = () => {
  switch (page) {
    case 'events': return <EventsPage />
    case 'surroundings': return <SurroundingsPage />
    case 'resources': return <ResourcesPage onGenerate={open()} applied={applied} />
    case 'response': return <ResponsePage />
    case 'orders': return <OrdersPage onRecommend={open()} applied={applied} />
    case 'assembly': return <AssemblyPage />
    case 'approval': return <ApprovalPage />
    case 'transport': return <TransportPage />
    case 'documents': return <DocumentsPage />
    case 'organization': return <OrganizationPage />
    case 'maps': return <MapsPage />
    case 'plan': return <PlanPage onGeneratePlan={open()} applied={applied} />
    case 'forces': return <ForcesPage />
    case 'tasks': return <TasksPage />
    case 'dynamics': return <DynamicsPage onOpenReport={onOpenReport} />
    case 'supplies': return <SuppliesPage />
    case 'briefs': return <BriefsPage />
    case 'return': return <ReturnPage />
    case 'records': return <RecordsPage />
    case 'summary': return <SummaryPage onGenerate={open()} applied={applied} />
    default: return <ResourcesPage />
  }
  }
  return <>{content()}{isEmpowermentKind(page) ? <SurroundingsAssistant enabled={aiEnabled} reportRequest={request} workflowKind={page} onApply={onApply} /> : null}</>
}
