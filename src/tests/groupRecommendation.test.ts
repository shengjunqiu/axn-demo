import { describe, expect, it } from 'vitest';
import { optimizeGroup, buildGroupRecommendation, type GroupCandidate } from '@/services/groupRecommendation';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { recognize } from '@/services/mock/provider';
import { catalogAction, stageChipConfig } from '@/seed/quickActionCatalog';

const candidate = (id:string, kind:string, eta:number, road:GroupCandidate['road']='passable'):GroupCandidate => ({id,name:id,kind,capability:'工程抢险',amount:'1组',status:'可用',distance:10,eta,road,estimated:true});
describe('智能编组推荐',()=>{
 it('按完整组合筛选，剔除阻断、不可用和超时候选',()=>{
   const result=optimizeGroup([candidate('team','team',20),candidate('blocked','equipment',10,'blocked'),candidate('equip','equipment',25),candidate('late','warehouse',200),candidate('material','warehouse',30),{...candidate('repair','equipment',1),status:'维修'}],['工程','抢险']);
   expect(result.best?.selected.map(c=>c.id)).toEqual(['team','equip','material']);
   expect(result.excluded.map(c=>c.id)).toEqual(['blocked','late','repair']);
 });
 it('缺少装备时不把队伍和仓库包装成完整最优编组',()=>{
   const result=optimizeGroup([candidate('team','team',20),candidate('material','warehouse',30)],['工程']);
   expect(result.best).toBeUndefined();
   expect(result.missing).toContain('作业装备');
 });
 it('道路未知惩罚和组合到场衔接影响择优',()=>{
   const result=optimizeGroup([candidate('team','team',20),candidate('unknown','equipment',20,'unknown'),candidate('known','equipment',20),candidate('material','warehouse',20)],['工程','抢险']);
   expect(result.best?.selected.map(c=>c.id)).toContain('known');
 });
 it('各灾种用本事件资源生成独立的组合表及待核通行条件',()=>{
   for(const p of DISASTER_PROFILES){
     const result=buildGroupRecommendation(p.eventId);
     expect(result.capability).toBe('group');
     expect(result.title).toContain(p.name);
     expect(result.tables?.[0].title).toBe('推荐编组与装备物资搭配表');
     expect(result.sections[0].text).toContain('道路通行');
     expect(result.notice).toContain('不代表正式调派');
   }
 });
 it('快捷目录与意图识别使用智能编组推荐',()=>{
   expect(catalogAction('智能编组推荐')?.kind).toBe('chat');
   expect(stageChipConfig('力量投送中').primary).toContain('智能编组推荐');
   expect(recognize('智能编组推荐',{lastResourceResultIds:[],candidateResourceIds:[]}).params.capability).toBe('group');
 });
});

 it('用户补充主路阻断且无备用通道时停止推荐完整编组',()=>{
  const p=DISASTER_PROFILES[0];
  const result=buildGroupRecommendation(p.eventId,'智能编组推荐，主路阻断');
  expect(result.summary).toContain('尚不能形成');
  expect(result.sections[0].text).toContain('暂停');
 });
