import { beforeEach, describe, expect, it } from 'vitest';
import { evaluationModuleTexts, evaluationActionReply } from '@/services/evaluationActions';
import { useCustomerOperations } from '@/store/customerOperationsStore';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';
import { useDemoStore } from '@/store/demoStore';
import { stageChipConfig, catalogAction } from '@/seed/quickActionCatalog';
import { DEFAULT_EVENT_ID } from '@/seed/scenario';
beforeEach(()=>{useDemoStore.getState().reset();useCustomerOperations.getState().reset();useKnowledgeCaseStore.getState().resetAll();});
describe('评估功能按钮与正文复用',()=>{
 it('招标功能保留独立快捷入口',()=>{
  const labels=stageChipConfig('待复盘').primary;
  expect(labels).toHaveLength(6);
  expect(labels.every(label=>catalogAction(label)?.kind==='chat')).toBe(true);
 });
 it('缺少计划和实际凭证时提示缺口，保留时间轴与条款正文',()=>{
  const modules=evaluationModuleTexts(DEFAULT_EVENT_ID,'test');
  expect(modules['资源投入偏差评估']).toContain('不推算人员装备数量偏差');
  expect(modules['七环节救援时间轴']).toContain('时间轴');
  expect(modules['预案条款对照']).toContain('尚缺');
 });
 it('发布只回复状态，检索提供模拟结果但不产生外部写操作',()=>{
  const before=useCustomerOperations.getState().publications.length;
  expect(evaluationActionReply('正式知识库审核发布',DEFAULT_EVENT_ID,'test')).toContain('未执行正式发布');
  expect(evaluationActionReply('正式知识检索',DEFAULT_EVENT_ID,'test')).toContain('未查询正式库');
  expect(useCustomerOperations.getState().publications.length).toBe(before);
 });
 it('未关联事件不引用其他事件资料',()=>{
  expect(evaluationActionReply('七环节救援时间轴','evt-blank-test','test')).toContain('请先关联');
 });
});

 it('模拟检索展示匹配条目、来源、版本、理由和详情',()=>{
  const reply=evaluationActionReply('正式知识检索',DEFAULT_EVENT_ID,'test');
  expect(reply).toContain('模拟检索完成');
  expect(reply).toContain('匹配结果：3条');
  expect(reply).toContain('来源：');
  expect(reply).toContain('版本：');
  expect(reply).toContain('匹配理由：');
  expect(reply).toContain('内容详情：');
 });
