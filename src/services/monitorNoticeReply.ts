import type { Notice } from './customerOperations';
import { eventDisplayName } from './factLookup';

export function monitorNoticeReply(eventId: string, notices: Notice[]): string {
  const unresolved = notices.filter(notice => notice.eventId === eventId && notice.status !== '已处理');
  if (!unresolved.length) return `${eventDisplayName(eventId)}当前没有待处理的监测通知。可在右侧查看历史通知及校验问题。`;
  return `${eventDisplayName(eventId)}当前有${unresolved.length}项监测问题尚未处理完成：\n\n${unresolved.map((notice, index) => `${index + 1}. ${notice.text}\n责任岗位：${notice.target}；处理状态：${notice.status}；外部通知：${notice.externalStatus}。`).join('\n\n')}\n\n请核对设备最新读数和来源，安排对应岗位处理，完成后在右侧登记处理结果。“已读”仍需继续跟进；模拟通知仅用于流程演示。`;
}
