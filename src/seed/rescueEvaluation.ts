/** 救援阶段性效果评估样例：独立模拟作业记录，不代表实际调派或处置结论。 */
export const RESCUE_EVALUATION_MOCK: Record<string, {
  target: number; completed: number; unit: string; objective: string;
  responseMinutes: number; targetMinutes: number; personnel: number; equipment: number;
  risk: string; next: string;
}> = {
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
};
