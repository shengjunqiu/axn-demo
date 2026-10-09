/** 值班模块暂时隐藏，保留模板、历史记录及原系统映射，便于恢复。 */
export const SHOW_DUTY_CONTENT = false;
export function isDutyContent(value: string): boolean {
  return !SHOW_DUTY_CONTENT && /DUTY_DAILY|doc_daily|值班|值守|交接日报/.test(value);
}

/** 会议纪要入口暂时隐藏（快捷任务 / 下一步建议 / 文书库分类），模板与生成逻辑保留便于恢复。 */
export const SHOW_MEETING_MINUTES = false;
export function isMeetingMinutesContent(value: string): boolean {
  return !SHOW_MEETING_MINUTES && /MEETING_MINUTES|会议纪要/.test(value);
}

/** 对话快捷动作与文书入口统一过滤。 */
export function isHiddenPrototypeAction(value: string): boolean {
  return isDutyContent(value) || isMeetingMinutesContent(value);
}
