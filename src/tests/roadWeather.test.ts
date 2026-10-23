import { expect, it } from 'vitest';
import { roadWeatherReply, startRouteConversation } from '@/services/roadWeather';
import { recognize } from '@/services/mock/provider';
import { sendMessage } from '@/services/taskRunner';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';

it('道路天气使用专用流程，当前事件结果不输出通用摘要或态势文书', async () => {
  const hit = recognize('核对道路天气', { lastResourceResultIds: [], candidateResourceIds: [] });
  expect(hit.params.capability).toBe('roadWeather');
  useDemoStore.getState().reset();
  useSessionStore.getState().resetAll();
  useDemoStore.getState().setPace('fast');
  useDemoStore.getState().switchEvent('evt-sim-landslide');
  const sessionId = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
  const taskId = await sendMessage(sessionId, { text: '核对道路天气' });
  await expect.poll(() => useSessionStore.getState().tasks[taskId]?.status, { timeout: 5000 }).toBe('succeeded');
  const task = useSessionStore.getState().tasks[taskId];
  expect(task.textAnswer).toContain('路线规划：');
  expect(task.textAnswer).toContain('天气与沿途道路提醒：');
  expect(task.textAnswer).not.toMatch(/协调负责人|投送顺序|分批投送|集结接应/);
  expect(task.textAnswer).not.toMatch(/资料不足|当前未取得|未接实时/);
  expect(task.textAnswer).toContain('塌方');
  expect(task.artifacts).toHaveLength(0);
  expect(task.textAnswer).not.toContain('人员伤亡情况');
});

it('未知事件不借用其他事件资料', () => {
  expect(roadWeatherReply('missing-event')).toBe('请先关联事件，再核对道路与天气。');
});

it('路线先对话确认，不自动打开地图或生成材料', () => {
  useSessionStore.getState().resetAll();
  const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-breach');
  startRouteConversation(sid, '帮我看看现场天气和沿途道路情况');
  const reply = useSessionStore.getState().sessions[sid].messages.at(-1)!;
  expect(reply.summaryOffer?.kind).toBe('map');
  expect(reply.reviewSummary?.rows.map(row => row.label)).toEqual(['路线规划', '天气与道路提醒']);
  expect(reply.text).toContain('用地图');
  expect(reply.documentWorkflow).toBeUndefined();
});
