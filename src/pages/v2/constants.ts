/** V2 独立原型的导航与当前事件。页面 id 与原独立包 hash 一致。 */
export const V2_PAGE_IDS = [
  'events',
  'surroundings',
  'resources',
  'response',
  'orders',
  'assembly',
  'approval',
  'transport',
  'documents',
  'organization',
  'maps',
  'plan',
  'forces',
  'tasks',
  'dynamics',
  'supplies',
  'briefs',
  'return',
  'records',
  'summary',
] as const

export type V2PageId = (typeof V2_PAGE_IDS)[number]

export const CHAT_PAGE_IDS = ['surroundings', 'resources', 'plan', 'dynamics', 'transport', 'tasks', 'documents'] as const
export type ChatPageId = (typeof CHAT_PAGE_IDS)[number]

export const EVENT_NAME = '江西省吉安市遂川县高坪镇明坑村-山体滑坡灾情'
export const DISASTER_TEXT = '9月5日6时40分，江西省吉安市遂川县高坪镇明坑村发生山体滑坡，初步了解有8栋房屋倒塌，造成10人左右被困。'
export const OPERATOR_NAME = '李霖枫'
export const SUPPORT_LINE = '中央企业应急救援综合平台　　技术支持：1850918563、15801264928'

export interface NavChild {
  name: string
  page: V2PageId
}

export interface NavGroup {
  name: string
  icon: string
  page?: V2PageId
  children?: NavChild[]
}

export const NAV_GROUPS: NavGroup[] = [
  { name: '事件列表', icon: '▣', page: 'events' },
  {
    name: '研判分析',
    icon: '◇',
    children: [
      { name: '周边资源分析报告', page: 'surroundings' },
      { name: '资源调度建议方案', page: 'resources' },
    ],
  },
  { name: '应急响应', icon: '◷', page: 'response' },
  {
    name: '力量抽组',
    icon: '♟',
    children: [
      { name: '指令下发', page: 'orders' },
      { name: '人装抽组', page: 'assembly' },
      { name: '审批报备', page: 'approval' },
      { name: '投送抽组方案', page: 'transport' },
      { name: '任务文书', page: 'documents' },
    ],
  },
  {
    name: '现场管理',
    icon: '⬡',
    children: [
      { name: '指挥机构管理', page: 'organization' },
      { name: '专题图制作', page: 'maps' },
      { name: '处置方案管理', page: 'plan' },
      { name: '现场力量管理', page: 'forces' },
      { name: '救援任务分配', page: 'tasks' },
      { name: '灾情动态', page: 'dynamics' },
      { name: '物资管理', page: 'supplies' },
    ],
  },
  { name: '要情快报', icon: '▤', children: [{ name: '要情快报', page: 'briefs' }] },
  { name: '回撤归建', icon: '⊙', children: [{ name: '回撤归建', page: 'return' }] },
  {
    name: '总结复盘',
    icon: '▧',
    children: [
      { name: '全过程记录', page: 'records' },
      { name: '总结报告', page: 'summary' },
    ],
  },
]

const PAGE_ID_SET: ReadonlySet<string> = new Set(V2_PAGE_IDS)
const CHAT_PAGE_SET: ReadonlySet<string> = new Set(CHAT_PAGE_IDS)

export function isV2Page(value: string | undefined): value is V2PageId {
  return !!value && PAGE_ID_SET.has(value)
}

export function isChatPage(value: V2PageId): value is ChatPageId {
  return CHAT_PAGE_SET.has(value)
}

export function findPageMeta(page: V2PageId): { groupName: string; title: string } {
  for (const group of NAV_GROUPS) {
    if (group.page === page) return { groupName: group.name, title: group.name }
    const child = group.children?.find(item => item.page === page)
    if (child) return { groupName: group.name, title: child.name }
  }
  return { groupName: '应急救援', title: '应急救援' }
}

export function groupIndexFor(page: V2PageId): number {
  return NAV_GROUPS.findIndex(group => group.page === page || group.children?.some(child => child.page === page))
}
