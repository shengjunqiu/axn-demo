import { clone } from './clone'
import type { LedgerTeam, ResourceDemand, ResourceLimits, SkillKey } from './resourceLogic'
import { SKILL_LABELS } from './resourceLogic'

const POOL: LedgerTeam[] = [
  { id: 'yongxin', name: '永新项目部', people: 18, totalEquipment: 12, distance: 136.39, travelHours: 2.12, prepHours: 0.5, priority: 1, available: true, routeOpen: true, skills: { search: 2, breaking: 2, engineering: 1, monitor: 0, communication: 1 }, equipment: { search: 2, breaking: 2, engineering: 1, monitor: 0, communication: 1 }, source: '人数、装备总量、距离及行进时长参考截图；初始可用状态、准备时长、专业与专项库存为演示补充。' },
  { id: 'jian', name: '吉安区域救援队（演示）', people: 36, totalEquipment: 24, distance: 85, travelHours: 1.5, prepHours: 0.5, priority: 2, available: true, routeOpen: true, skills: { search: 2, breaking: 2, engineering: 2, monitor: 2, communication: 2 }, equipment: { search: 1, breaking: 2, engineering: 2, monitor: 1, communication: 2 }, source: '完整演示候选，不代表实际队伍或实时库存。' },
  { id: 'nanchang', name: '南昌队常备中队', people: 54, totalEquipment: 42, distance: 432.98, travelHours: 5.87, prepHours: 0.25, priority: 1, available: true, routeOpen: true, skills: { search: 3, breaking: 3, engineering: 3, monitor: 2, communication: 2 }, equipment: { search: 4, breaking: 6, engineering: 5, monitor: 2, communication: 4 }, source: '人数、装备总量、距离和行进时长参考截图；模拟初始可用状态，不能把历史“已返营”记录当作现在可调。其余属性为演示补充。' },
  { id: 'monitor', name: '地质监测分队（演示）', people: 12, totalEquipment: 8, distance: 190, travelHours: 3.1, prepHours: 0.4, priority: 1, available: true, routeOpen: true, skills: { search: 0, breaking: 0, engineering: 0, monitor: 3, communication: 2 }, equipment: { search: 0, breaking: 0, engineering: 0, monitor: 3, communication: 2 }, source: '完整演示候选，不代表实际队伍或实时库存。' },
  { id: 'engineering', name: '工程保障分队（演示）', people: 28, totalEquipment: 20, distance: 220, travelHours: 3.8, prepHours: 0.7, priority: 3, available: true, routeOpen: true, skills: { search: 0, breaking: 1, engineering: 3, monitor: 1, communication: 2 }, equipment: { search: 0, breaking: 1, engineering: 5, monitor: 1, communication: 3 }, source: '完整演示候选，不代表实际队伍或实时库存。' },
  { id: 'meijiang', name: '梅江灌区项目部', people: 0, totalEquipment: 0, distance: 279.15, travelHours: 4.37, prepHours: 0, priority: 2, available: false, routeOpen: false, skills: {}, equipment: {}, source: '截图显示0人/0装备；没有可调资源，自动排除，不编造专业能力或到场保障。' },
]

export interface ResourceSettings {
  demand: ResourceDemand
  limits: ResourceLimits
  enabled: string[]
}

export function resourcePool(): LedgerTeam[] {
  return clone(POOL)
}

export function defaultResourceSettings(): ResourceSettings {
  return {
    demand: {
      people: 60,
      requiredSkills: Object.keys(SKILL_LABELS),
      prioritySkill: 'search' satisfies SkillKey,
      equipment: { search: 2, breaking: 2, engineering: 2, monitor: 1, communication: 1 },
    },
    limits: { maxDistance: 500, maxArrival: 8, firstDeadline: 3, firstPeople: 20, maxTeams: 3, minLevel: 2 },
    enabled: POOL.filter(team => team.available).map(team => team.id),
  }
}
