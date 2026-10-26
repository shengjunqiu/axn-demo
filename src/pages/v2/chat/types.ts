import type { ChatPageId } from '../constants'
import type { ForceBaseline, ForceImpact, MergeResult, PlanBaseline, PlanImpact, PlanImpactRow } from '../logic/dynamicsLogic'

export interface TransportTeam {
  name: string
  people: number
  equipment: number
  contact: string
  phone: string
  distance: string
  mode: string
  travel: string
  task: string
  personnel: number
}

export interface ChatContext {
  event: string
  disaster: string
  page: ChatPageId
  title: string
  breadcrumb: string
  initialPlan: PlanBaseline
  initialForces: ForceBaseline
  transport: { people: number; equipment: number; teams: TransportTeam[] }
  document: { name: string; instruction: string; echelon: string }
}

export interface ChatSection {
  title: string
  paragraphs: string[]
}

export interface ChatResult {
  title: string
  kind?: string
  recommended?: boolean
  paragraphs?: string[]
  table?: { headers: string[]; rows: string[][] }
  sections?: ChatSection[]
  event?: string
  module?: string
  version?: number
}

export interface DynamicTransfer {
  event: string
  summary: string
  baselineId: string
  baselineTitle: string
  planRows: PlanImpactRow[]
  complete: boolean
  latestFacts: MergeResult['latest']
  resourceSummary: string
}

export interface EngineReply {
  text: string
  results: ChatResult[]
  suggestions: string[]
  question?: boolean
  transfer?: DynamicTransfer
}

export interface EngineSession {
  context: ChatContext
  resource: {
    demand: { people: number; requiredSkills: string[]; prioritySkill: string; equipment: Record<string, number> }
    limits: { maxDistance: number; maxArrival: number; firstDeadline: number; firstPeople: number; maxTeams: number; minLevel: number }
    enabled: string[]
  }
  reportIds: string[]
  pending: string | null
  plan: {
    task: string
    supplement: string
    conditions: { time: string; road: string; risk: string; weather: string; notes: string[] }
    resources: string
    status: string
    dynamicUpdate: DynamicTransfer | null
    currentDisaster?: string
  }
  taskText: string
  taskView: 'tasks' | 'owners' | 'table'
  documentText: string
  documentView: 'draft' | 'short' | 'requirements'
  lastDynamic: { analysis: MergeResult; plan: PlanImpact; forces: ForceImpact } | null
  revision: number
}
