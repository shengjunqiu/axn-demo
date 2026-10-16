import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AgentTask } from '@/domain/types';
import TaskSkillPanel from '@/components/skills/TaskSkillPanel';
import { skillOwnerForTask } from '@/seed/skillPlanning';

const task: AgentTask = {
  taskId: 'test-task', sessionId: 'test-session', eventId: 'event-A', userMessageId: 'message-A',
  attemptId: 'attempt-2', attempt: 2, status: 'failed', intent: 'proposal', displayTitle: '生成方案',
  steps: [{ stepId: 'p1', name: '核对原方案', status: 'failed', inputSummary: '方案 V3', outputSummary: null, sourceRefs: ['source-A'], elapsedMs: null, errorCode: 'UPSTREAM_UNAVAILABLE' }],
  artifacts: [], textAnswer: null, error: null, startedAt: '2026-10-08T10:00:00+08:00', finishedAt: null, demoElapsedMs: null, seq: 1,
};

describe('任务与 Skill 规划对照', () => {
  it('优先按场景产物负责智能体归属，避免通用 intent 错归文书', () => {
    expect(skillOwnerForTask({ intent: 'doc_brief', artifacts: [{ artifactId: 'a', payload: { kind: 'scenario_sections', capability: 'rescueEvaluation', agentId: 'agent-eval', title: '复盘', summary: '', sections: [], notice: '', dataTime: '' } }] })).toBe('evaluation');
    expect(skillOwnerForTask({ intent: 'qa_knowledge', artifacts: [] })).toBeNull();
  });
  it('显示真实失败步骤和来源，不将规划能力标为执行成功', async () => {
    render(<TaskSkillPanel task={task} />);
    fireEvent.click(screen.getByRole('button', { name: '查看本次执行与能力分工' }));
    expect(await screen.findByText('执行失败')).toBeTruthy();
    expect(screen.getByText('尚无输出记录', { exact: false })).toBeTruthy();
    expect(screen.getByText('来源：source-A')).toBeTruthy();
    expect(screen.getByText('失败原因：UPSTREAM_UNAVAILABLE')).toBeTruthy();
    expect(screen.queryByText('模拟已完成')).toBeNull();
    expect(screen.getByRole('button', { name: '预案RAG · 待建设' })).toBeTruthy();
  });
});
