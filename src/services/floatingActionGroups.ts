import type { EventStage } from './agentFlow';
import { stageChoices, type StageChoiceGroup } from './stageConversation';
import { LEGACY_QUICK_ACTIONS } from '@/seed/quickActionCatalog';
import { tenderName } from '@/seed/tenderNames';

const relevantActions: Record<EventStage, readonly string[]> = {
  待研判: ['核对道路天气', '生成周边资源报告'],
  力量投送中: ['生成周边资源报告', '核对道路天气'],
  救援中: ['核对道路天气', '预案条款对照'],
  待复盘: ['七环节救援时间轴', '预案条款对照'],
  已归档: ['七环节救援时间轴', '预案条款对照'],
};

/** 保留全部入口，当前事件阶段相关的提问和快捷操作优先展示。 */
export function floatingActionGroups(stage: EventStage | null): StageChoiceGroup[] {
  const groups = stageChoices(stage ?? '待研判');
  const preferred = stage ? relevantActions[stage] : [];
  const quick = (labels: readonly string[]): StageChoiceGroup['options'] => labels.map(label => ({
    id: `legacy-quick:${label}`, kind: 'question', label: tenderName(label), prompt: label,
  }));
  return [
    { ...groups[0], label: stage ? `${stage}相关提问` : '常用提问（未关联事件）' },
    { label: '当前阶段快捷操作', options: quick(preferred) },
    groups[1],
    { label: '其他快捷操作', options: quick(LEGACY_QUICK_ACTIONS.filter(label => !preferred.includes(label))) },
    groups[2],
  ].filter(group => group.options.length > 0);
}
