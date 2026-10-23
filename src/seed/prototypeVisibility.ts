/** 按客户要求开放值班日报入口与历史记录。 */
export const SHOW_DUTY_CONTENT = true;
export function isDutyContent(value: string): boolean {
  return !SHOW_DUTY_CONTENT && /DUTY_DAILY|doc_daily|值班|值守|交接日报/.test(value);
}

/** 按客户要求开放会议纪要入口、快捷任务及文书库分类。 */
export const SHOW_MEETING_MINUTES = true;
export function isMeetingMinutesContent(value: string): boolean {
  return !SHOW_MEETING_MINUTES && /MEETING_MINUTES|会议纪要/.test(value);
}

/**
 * 「资源数据与预警」工作区（设备采集 / 出入库 / 定期监测 / 通知与问题 / 接口）暂时下线。
 * 预警推送 / 资源预警通知改走 OperationalFlows 内 WarningPushPanel。
 */
export const SHOW_RESOURCE_DATA_ALERT = false;
export function isResourceDataAlertContent(value: string): boolean {
  return !SHOW_RESOURCE_DATA_ALERT && /资源数据与预警/.test(value);
}

/** 对话快捷动作与文书入口统一过滤。 */
export function isHiddenPrototypeAction(value: string): boolean {
  return isDutyContent(value) || isMeetingMinutesContent(value) || isResourceDataAlertContent(value);
}

/** 按客户要求隐藏「灾种事件库」整页模块及入口。 */
export const SHOW_DISASTER_EVENTS_LIBRARY = false;
