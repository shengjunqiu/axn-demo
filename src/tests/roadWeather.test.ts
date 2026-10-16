import { expect, it } from 'vitest';
import { roadWeatherReply } from '@/services/roadWeather';
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
  expect(task.textAnswer).toContain('道路通行：待核实');
  expect(task.textAnswer).toContain('天气情况：待核实');
  expect(task.textAnswer).toContain('塌方');
  expect(task.artifacts).toHaveLength(0);
  expect(task.textAnswer).not.toContain('人员伤亡情况');
});

it('未知事件不借用其他事件资料', () => {
  expect(roadWeatherReply('missing-event')).toBe('请先关联事件，再核对道路与天气。');
});
