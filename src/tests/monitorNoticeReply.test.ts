import { expect, it } from 'vitest';
import { monitorNoticeReply } from '@/services/monitorNoticeReply';
import type { Notice } from '@/services/customerOperations';
const notice: Notice = { id: 'n', eventId: 'evt-demo-001', ruleId: 'r', target: '装备岗', text: '电量低于20%', status: '待处理', externalStatus: '未发送', receipt: '', readingId: 'reading', createdAt: '2026-10-12T09:00:00+08:00' };
it('仅汇总当前事件未处理问题，已读仍需跟进', () => {
  const text = monitorNoticeReply(notice.eventId, [notice, { ...notice, id: 'read', status: '已读', text: '油量不足' }, { ...notice, eventId: 'other', text: '他案问题' }, { ...notice, status: '已处理', text: '历史问题' }]);
  expect(text).toContain('2项监测问题'); expect(text).toContain('油量不足'); expect(text).toContain('外部通知：未发送');
  expect(text).not.toContain('他案问题'); expect(text).not.toContain('历史问题');
});
it('没有未处理项时给出明确回复', () => expect(monitorNoticeReply(notice.eventId, [{ ...notice, status: '已处理' }])).toContain('没有待处理'));
