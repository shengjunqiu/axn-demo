import { useConversationStore } from '@/store/conversationStore';
import ResourcePanel from '@/components/workspace/ResourcePanel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISASTER_PROFILES, disasterDocumentSections } from '@/seed/disasterScenarios';
import { incidentById, incidents, factById } from '@/seed/scenario';
import { buildConstructionResult } from '@/seed/constructionScenarios';
import { vueDemoResourcesForEvent } from '@/seed/vueDemoResources';
import { resolveFact, resourceAllowed } from '@/services/factLookup';
import { buildMultiSourceSnapshot } from '@/services/multiSourceAggregation';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { sendMessage } from '@/services/taskRunner';
import { stageOriginalMaterial, readOriginalMaterials, receiveOriginalMaterial } from '@/services/originalSystem';
import DisasterEventsPage from '@/components/events/DisasterEventsPage';

beforeEach(() => { useSessionStore.getState().resetAll(); useDemoStore.getState().setPace('fast'); vi.useFakeTimers(); });
afterEach(() => { cleanup(); useSessionStore.getState().resetAll(); vi.useRealTimers(); });
describe('灾种事件与材料隔离', () => {
  it('三类实战事件均能解析自己的来源，跨事件不能读取', () => {
    expect(DISASTER_PROFILES).toHaveLength(3);
    // 关联灾情：三类实战 × 待研判/力量投送中/救援中/待复盘
    expect(incidents).toHaveLength(12);
    expect(DISASTER_PROFILES.map((p) => p.category)).toEqual(['山体滑坡', '洪涝决口', '泥石流']);
    for (const p of DISASTER_PROFILES) {
      const i = incidentById.get(p.eventId)!;
      for (const id of Object.values(i.factRefs)) {
        expect(factById.has(id)).toBe(true);
        expect(resolveFact(id, {kind:'event',eventId:p.eventId})).not.toBeNull();
        expect(resolveFact(id, {kind:'event',eventId:'evt-demo-001'})).toBeNull();
      }
      expect(vueDemoResourcesForEvent(p.eventId).every(r=>r.eventId===p.eventId)).toBe(true);
      expect(resourceAllowed('team-001',p.eventId)).toBe(false);
      const snapshot = buildMultiSourceSnapshot(p.eventId);
      expect(snapshot.event.title).toBe(p.name);
      expect(snapshot.event.sources.flatMap(s=>s.records).every(r=>r.id.includes(p.eventId))).toBe(true);
    }
  });
  it.each(DISASTER_PROFILES)('$category 对话生成态势、资源和方案使用本事件内容与适用预案', async p => {
    useDemoStore.getState().switchEvent(p.eventId);
    const sid = useSessionStore.getState().ensureSessionForEvent(p.eventId);
    for (const prompt of ['生成态势报告','查询周边救援资源','生成救援方案']) {
      await sendMessage(sid,{text:prompt}); await vi.runAllTimersAsync();
      const task = Object.values(useSessionStore.getState().tasks).filter(t=>t.sessionId===sid).at(-1)!;
      expect(task.status).toBe('succeeded');
      expect(task.textAnswer).toContain(p.category);
      expect(task.textAnswer).toContain(p.resources[1].name);
      for (const other of DISASTER_PROFILES.filter(o=>o.eventId!==p.eventId)) expect(task.textAnswer).not.toContain(other.name);
      if (prompt==='生成救援方案') {
        const proposal = Object.values(useSessionStore.getState().proposals).find(v=>v.eventId===p.eventId)!;
        expect(proposal.knowledgeRefs).toEqual([`kb-${p.eventId}`]);
        expect(proposal.sections.some(s=>s.text.includes(p.planTitle))).toBe(true);
      }
      if (prompt==='查询周边救援资源') expect(useSessionStore.getState().sessions[sid].lastResourceResultIds).toEqual(vueDemoResourcesForEvent(p.eventId).map(r=>r.id));
    }
    const document = useMockDocumentStore.getState().libraries[sid].selected!;
    expect(document.sections.map(s=>s[1]).join('\n')).toContain(p.planTitle);
    localStorage.removeItem('anneng-demo:v1:original-materials');
    const url = stageOriginalMaterial({code:document.code,eventId:p.eventId,title:document.title,sourceId:document.id,sections:document.sections});
    expect(url).toContain(`event=${p.eventId}`); expect(url).toContain('page=S03');
    const record = readOriginalMaterials()[0];
    expect(record.sections.some(s=>s[1].includes(p.planTitle))).toBe(true);
    expect(()=>receiveOriginalMaterial(record.id,'evt-demo-001',record.system,record.page)).toThrow();
  });
  it('切换事件不复用候选资源，生成文书也不用排涝通用正文', async () => {
    const landslide = DISASTER_PROFILES.find(p => p.eventId === 'evt-sim-landslide')!;
    const debris = DISASTER_PROFILES.find(p => p.eventId === 'evt-sim-debris')!;
    useDemoStore.getState().switchEvent(landslide.eventId);
    const a=useSessionStore.getState().ensureSessionForEvent(landslide.eventId);
    const r=sendMessage(a,{text:'查询周边救援资源'});await vi.runAllTimersAsync();await r;
    useSessionStore.getState().toggleCandidate(a,vueDemoResourcesForEvent(landslide.eventId)[0].id);
    useDemoStore.getState().switchEvent(debris.eventId);
    const b=useSessionStore.getState().ensureSessionForEvent(debris.eventId);
    expect(useSessionStore.getState().sessions[b].candidateResourceIds).toEqual([]);
    useSessionStore.getState().toggleCandidate(b,vueDemoResourcesForEvent(landslide.eventId)[0].id);
    expect(useSessionStore.getState().sessions[b].candidateResourceIds).toEqual([]);
    const pending=useMockDocumentStore.getState().generate(b,'EMERGENCY_BRIEF');await vi.runAllTimersAsync();const doc=await pending;
    const body=doc!.sections.map(s=>s[1]).join('\n');expect(body).toContain('泥石流');expect(body).not.toContain('清河段');expect(body).not.toContain('围井反滤');
    expect(buildConstructionResult('group',debris.eventId,'2台').sections.map(s=>s.text).join('\n')).not.toContain('排涝车');
  });
  it('事件库切换后图表单位和预案同步变化', () => {
    vi.useRealTimers();
    render(<AntdApp><MemoryRouter initialEntries={['/events?event=evt-sim-landslide']}><DisasterEventsPage/></MemoryRouter></AntdApp>);
    expect(screen.getByRole('img',{name:/山体滑坡|滑坡|位移/})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/泥石流/}));
    expect(screen.getByRole('img',{name:/泥石流/})).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:'预案与报告'}));
    expect(screen.getByTestId('disaster-material').textContent).toMatch(/泥石流|预案/);
  });
  it('模拟候选面板列出独立数量，不显示为授权台账零人数', async () => {
    const p = DISASTER_PROFILES.find(item => item.eventId === 'evt-sim-landslide')!;
    const conversation = useConversationStore.getState().createConversation({title:p.name,type:'emergency',eventId:p.eventId});
    const sid = useSessionStore.getState().sessionByConversation[conversation.id];
    await sendMessage(sid, {text:'查询周边救援资源'}); await vi.runAllTimersAsync();
    vi.useRealTimers();
    render(<ResourcePanel/>);
    const teamName = p.resources[0].name;
    fireEvent.click(screen.getByRole('checkbox',{name: new RegExp(`选择 ${teamName}`)}));
    expect(screen.getByText('模拟候选 1 项')).toBeTruthy();
    expect(screen.getByText(new RegExp(`${teamName}`))).toBeTruthy();
    expect(screen.queryByText('候选人员总数')).toBeNull();
  });
  it('三类材料内容各自包含适用预案，非水灾种不夹带堤防工法', () => {
    for (const p of DISASTER_PROFILES) {
      const body=disasterDocumentSections(p.eventId,'RESCUE_PLAN')!.map(s=>s[1]).join('\n');
      expect(body).toContain(p.planTitle);
      if (['evt-sim-landslide','evt-sim-debris'].includes(p.eventId)) expect(body).not.toMatch(/管涌点位|围井反滤|排涝车/);
    }
  });

  it('三类文书骨架对齐一期：资源报告七段、处置方案含任务受领与主要措施', () => {
    const resourceTitles = [
      '一、抢险基本信息',
      '二、安能队伍情况',
      '三、其他央企队伍情况',
      '四、安能装备情况',
      '五、其他央企装备情况',
      '六、重点防护目标情况',
      '七、范围与数据核验',
    ];
    const nonWater = new Set([
      'evt-sim-landslide',
      'evt-sim-debris',
    ]);
    for (const p of DISASTER_PROFILES) {
      const resource = disasterDocumentSections(p.eventId, 'RESOURCE_REPORT')!;
      expect(resource.map(s => s[0])).toEqual(resourceTitles);
      expect(resource.map(s => s[1]).join('\n')).toContain(p.name);

      const plan = disasterDocumentSections(p.eventId, 'RESCUE_PLAN')!;
      const planTitles = plan.map(s => s[0]);
      expect(planTitles).toContain('二、任务和救援目标');
      expect(planTitles).toContain('四、救援行动安排');
      expect(planTitles).toContain('五、安全与保障措施');
      expect(plan.map(s => s[1]).join('\n')).toMatch(/救援基本条件|战法|安全预警/);

      if (nonWater.has(p.eventId)) {
        expect(plan.map(s => s[1]).join('\n')).not.toMatch(/管涌|围井反滤/);
      }
    }
  });
});
