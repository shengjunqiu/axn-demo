import { describe, expect, it } from 'vitest';
import {
  assessInput,
  buildStageEventContext,
  simulateAttachment,
  stageChoices,
  type StageChoice,
} from '@/services/stageConversation';

const fileChoice = (type: string, label: string): StageChoice => ({
  id: `file-${type}`,
  kind: 'file',
  type,
  label: `发送${label}`,
  prompt: `请读取附件，结合当前事件整理${label}`,
});

describe('stageConversation', () => {
  it('stageChoices 按阶段分组且含异常示例', () => {
    const groups = stageChoices('救援中');
    expect(groups.map(g => g.label)).toEqual([
      '当前阶段常见提问',
      '模拟发送 Word 文件',
      '异常与意图确认示例',
    ]);
    expect(groups[1].options.some(o => o.type === 'advice')).toBe(true);
    expect(groups[2].options.some(o => o.type === 'unclear')).toBe(true);
  });

  it('simulateAttachment 生成模拟 Word 命名与正文', () => {
    const event = buildStageEventContext('evt-demo-002');
    const attachment = simulateAttachment(fileChoice('advice', '处置建议'), {
      ...event,
      stage: '救援中',
    });
    expect(attachment.name).toBe('处置建议.docx');
    expect(attachment.simulated).toBe(true);
    expect(attachment.eventId).toBe(event.id);
    expect(attachment.content).toBeTruthy();
  });

  it('assessInput：wrongEvent / missing / ambiguous / mismatch', () => {
    const event: ReturnType<typeof buildStageEventContext> = {
      id: 'evt-a',
      name: '事件A',
      stage: '救援中',
      risks: '余震风险',
      materials: [
        { id: 'event', text: '现场说明待补' },
        { id: 'plan', text: '方案待补' },
        { id: 'resources', text: '人装待补' },
      ],
    };

    expect(
      assessInput(event, {
        id: '1',
        name: '其他.docx',
        type: 'wrongEvent',
        eventId: 'EV-DEMO-OTHER',
        simulated: true,
        kind: '模拟 Word 附件',
        status: '模拟',
        content: 'x',
      })?.kind,
    ).toBe('wrongEvent');

    expect(
      assessInput(event, {
        id: '2',
        name: '缺事件.docx',
        type: 'missing',
        eventId: null,
        simulated: true,
        kind: '模拟 Word 附件',
        status: '模拟',
        content: 'x',
      })?.kind,
    ).toBe('missing');

    expect(
      assessInput(event, {
        id: '3',
        name: '工作材料.docx',
        type: 'unclear',
        eventId: event.id,
        simulated: true,
        kind: '模拟 Word 附件',
        status: '模拟',
        content: 'x',
      })?.kind,
    ).toBe('ambiguous');

    const summary = simulateAttachment(fileChoice('summary', '总结报告'), event);
    expect(assessInput(event, summary)?.kind).toBe('mismatch');
  });
});
