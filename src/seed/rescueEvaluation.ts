import { DISASTER_PROFILES } from './disasterScenarios';
/** 救援阶段性效果评估样例：独立模拟作业记录，不代表实际调派或处置结论。 */
export const RESCUE_EVALUATION_MOCK: Record<string, {
  target: number; completed: number; unit: string; objective: string;
  responseMinutes: number; targetMinutes: number; personnel: number; equipment: number;
  risk: string; next: string;
}> = {
  ...Object.fromEntries(DISASTER_PROFILES.map(p => [p.eventId, {
    target: p.target, completed: p.completed, unit: p.unit, objective: p.objective,
    responseMinutes: 25, targetMinutes: 30, personnel: Number.parseInt(p.resources[0].amount), equipment: Number.parseInt(p.resources[1].amount),
    risk: p.risks, next: p.gaps,
  }])),
  'evt-demo-001': {
    target: 120, completed: 108, unit: '人', objective: '群众转移安置',
    responseMinutes: 18, targetMinutes: 20, personnel: 32, equipment: 4,
    risk: '堤防渗漏仍需持续观测，剩余12人的转移安置情况需跟踪确认。',
    next: '完成剩余人员转移与安置登记；复查重点堤段；持续监测水位并更新现场反馈。',
  },
  'evt-demo-002': {
    target: 3, completed: 2, unit: '处', objective: '重点积水点处置',
    responseMinutes: 15, targetMinutes: 20, personnel: 18, equipment: 3,
    risk: '仍有1处积水点正在处置，降雨变化可能造成积水反复。',
    next: '继续跟踪剩余积水点，检查排水设备与供电保障，达到安全条件后再评估恢复通行。',
  },
  // Vue 建设场景事件（对齐 eventWorkspace 演示口径）
  'evt-vue-nl08': {
    target: 2, completed: 1, unit: '套泵', objective: '排涝泵组到位与抽排',
    responseMinutes: 18, targetMinutes: 20, personnel: 12, equipment: 1,
    risk: '计划泵2套、实际到位1套；涉水触电与地下空间进水风险仍待核。',
    next: '补核泵组差额原因；核实受困对象与排水去向后评估通行条件。',
  },
  'evt-vue-nd01': {
    target: 1, completed: 0, unit: '处', objective: '管涌点先遣勘察与反滤准备',
    responseMinutes: 25, targetMinutes: 30, personnel: 8, equipment: 2,
    risk: '渗流发展与堤体稳定尚未形成专业勘察结论，候选力量未正式出动。',
    next: '完成技术勘察回执；确认反滤材料与投送编组后再评估处置进展。',
  },
  'evt-vue-g5513': {
    target: 1, completed: 1, unit: '处', objective: '边坡处置与道路作业',
    responseMinutes: 22, targetMinutes: 30, personnel: 16, equipment: 3,
    risk: '成果验收与消耗凭证尚不完整，暂不认定任务全部完成。',
    next: '补齐验收与消耗凭证；整理过程资料后进入总结复盘。',
  },
};
