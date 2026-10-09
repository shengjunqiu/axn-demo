import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {DISASTER_PROFILES} from '@/seed/disasterScenarios';
import {monitoringTrend,resourceComposition} from '@/services/tenderScenario';
import {buildMultiSourceSnapshot} from '@/services/multiSourceAggregation';
import SituationForecast from '@/components/events/SituationForecast';
import ResourceComposition from '@/components/events/ResourceComposition';
import RescueEvaluation from '@/components/events/RescueEvaluation';
import SkillRuntimeDemo from '@/components/skills/SkillRuntimeDemo';
import {isDutyContent, isHiddenPrototypeAction, isMeetingMinutesContent} from '@/seed/prototypeVisibility';
afterEach(cleanup);
describe('招标交互与事件隔离',()=>{
  it('以真实采样间隔推演，无法解析的时间不计算',()=>{
    const m={label:'示例',unit:'m',times:['11:00','11:30'],values:[10,12],source:'模拟'};
    expect(monitoringTrend(m,15).projection).toBe(13);
    expect(monitoringTrend({...m,times:['缺测','缺测']},15).projection).toBeNull();
    expect(monitoringTrend({...m,values:[12],times:['11:30']},15).projection).toBeNull();
  });
  it.each(DISASTER_PROFILES)('$category 使用本事件单位、缺口和快照时间',p=>{
    const rows=resourceComposition(p,2,true);
    expect(rows.map(r=>r.name)).toEqual(p.resources.map(r=>r.name));
    for(const row of rows){if(row.available!==null)expect(row.gap).toBe(row.available);expect(row.route).toContain('备用');expect(row.id).toContain(p.eventId);}
    expect(buildMultiSourceSnapshot(p.eventId).gatheredAt).toBe(p.capturedAt);
  });
  it('情景依据修改后撤销已生成结果',()=>{
    render(<SituationForecast profile={DISASTER_PROFILES[6]}/>);
    expect((screen.getByRole('button',{name:'生成研判情景（模拟）'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('研判情景依据'),{target:{value:'模拟采样条件保持不变，需专家复核'}});
    fireEvent.click(screen.getByRole('button',{name:'生成研判情景（模拟）'}));
    expect(screen.getByText('灾害影响范围与次生风险')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('研判情景依据'),{target:{value:'采样条件发生变化'}});
    expect(screen.queryByText('灾害影响范围与次生风险')).toBeNull();
  });
  it('编组约束变化必须重新确认',()=>{
    render(<ResourceComposition profile={DISASTER_PROFILES[6]}/>);
    fireEvent.change(screen.getByLabelText('专业编组确认人'),{target:{value:'演示核对人'}});
    fireEvent.click(screen.getByRole('button',{name:'确认模拟编组建议'}));
    expect(screen.getByText('演示核对人 已核对 · 待正式调派')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox',{name:'主路灾害阻断（模拟）'}));
    expect(screen.queryByText('演示核对人 已核对 · 待正式调派')).toBeNull();
  });
  it('评估缺少计划、实际或证据不生成，修改数量撤销核验',()=>{
    const p=DISASTER_PROFILES[6];render(<RescueEvaluation profile={p}/>);
    const button=screen.getByRole('button',{name:'保存评估版本（模拟）'}) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(p.resources[0].name+'计划数量'),{target:{value:'16'}});
    fireEvent.change(screen.getByLabelText(p.resources[0].name+'实际数量'),{target:{value:'12'}});
    fireEvent.change(screen.getByLabelText('评估证据与统计口径'),{target:{value:'模拟计划V1与现场回执，截止11:30'}});
    fireEvent.click(screen.getByRole('checkbox',{name:/已人工核对/}));
    fireEvent.click(button);expect(screen.getByText(/评估 V1 已生成/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(p.resources[0].name+'实际数量'),{target:{value:'13'}});
    expect(button.disabled).toBe(true);
  });
  it('能力卸载及未授权均拒绝调用',()=>{
    render(<SkillRuntimeDemo/>);
    fireEvent.click(screen.getByRole('button',{name:'模拟调用'}));
    expect(screen.getByText(/PERMISSION_DENIED/)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch',{name:'能力启用演示'}));
    fireEvent.click(screen.getByRole('button',{name:'模拟调用'}));
    expect(screen.getByText(/SKILL_UNAVAILABLE/)).toBeTruthy();
  });
  it('隐藏值班与会议纪要入口，同时保留应急文书', () => {
    expect(isDutyContent('DUTY_DAILY')).toBe(true);
    expect(isDutyContent('值班日报')).toBe(true);
    expect(isMeetingMinutesContent('MEETING_MINUTES')).toBe(true);
    expect(isMeetingMinutesContent('生成会议纪要')).toBe(true);
    expect(isHiddenPrototypeAction('MEETING_MINUTES')).toBe(true);
    expect(isDutyContent('应急要情')).toBe(false);
    expect(isHiddenPrototypeAction('应急要情')).toBe(false);
  });
});
