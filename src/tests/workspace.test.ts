/**
 * workspaceStore 单测（UI 选择状态）：
 * 选择状态按会话作用域隔离、区分 mock / draft、关闭抑制同一完成、
 * 未保存编辑标记按作用域隔离。无 React 渲染，直接驱动 store。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_SCOPE, useWorkspaceStore } from '@/store/workspaceStore';

const A = 'session-A';
const B = 'session-B';
const store = () => useWorkspaceStore.getState();

beforeEach(() => {
  useWorkspaceStore.getState().resetAll();
});

describe('workspaceStore 文书选择状态', () => {
  it('默认模式为对话，模式按作用域隔离', () => {
    expect(store().modeOf(A)).toBe('chat');
    store().setMode(A, 'work');
    expect(store().modeOf(A)).toBe('work');
    expect(store().modeOf(B)).toBe('chat');
  });

  it('未选择时关闭；选择 mock / draft / flow 后打开且互相区分', () => {
    expect(store().isOpen(A)).toBe(false);
    expect(store().selectionOf(A)).toBeNull();

    store().select(A, { kind: 'mock', id: 'sample-DUTY_DAILY-0' });
    expect(store().selectionOf(A)).toEqual({ kind: 'mock', id: 'sample-DUTY_DAILY-0' });
    expect(store().isOpen(A)).toBe(true);

    store().select(A, { kind: 'draft', id: 'doc-1' });
    expect(store().selectionOf(A)).toEqual({ kind: 'draft', id: 'doc-1' });

    store().select(A, { kind: 'flow', id: '现场智能勘察' });
    expect(store().selectionOf(A)).toEqual({ kind: 'flow', id: '现场智能勘察' });
    expect(store().isOpen(A)).toBe(true);

    store().select(A, { kind: 'resource', id: 'map' });
    expect(store().selectionOf(A)).toEqual({ kind: 'resource', id: 'map' });
    expect(store().isOpen(A)).toBe(true);
  });

  it('A 会话的选择不影响 B 会话', () => {
    store().select(A, { kind: 'draft', id: 'doc-A' });
    expect(store().isOpen(B)).toBe(false);
    expect(store().selectionOf(B)).toBeNull();
    expect(store().scopes[B] ?? EMPTY_SCOPE).toEqual(EMPTY_SCOPE);
  });

  it('关闭抑制同一完成，新完成或显式选择仍会打开', () => {
    // 生成中自动打开
    store().autoOpen(A, 'run:t1:a1', { kind: 'generating' });
    expect(store().isOpen(A)).toBe(true);
    expect(store().selectionOf(A)).toBeNull();
    // 完成后自动打开产出草稿
    store().autoOpen(A, 'run:t1:a1', { kind: 'draft', id: 'doc-1' });
    expect(store().selectionOf(A)).toEqual({ kind: 'draft', id: 'doc-1' });
    // 用户关闭（不带 token → 抑制最近一次自动打开标记）
    store().close(A);
    expect(store().isOpen(A)).toBe(false);
    // 同一完成在无关重渲染 / 重新挂载时不再弹出
    for (let i = 0; i < 3; i++) store().autoOpen(A, 'run:t1:a1', { kind: 'draft', id: 'doc-1' });
    expect(store().isOpen(A)).toBe(false);
    expect(store().selectionOf(A)).toBeNull();
    // 新的完成标记仍会自动打开
    store().autoOpen(A, 'run:t2:a2', { kind: 'draft', id: 'doc-2' });
    expect(store().selectionOf(A)).toEqual({ kind: 'draft', id: 'doc-2' });
    // 显式打开（聊天预览 / 文书库条目）不受关闭标记限制
    store().close(A, 'draft:doc-2');
    expect(store().isOpen(A)).toBe(false);
    store().select(A, { kind: 'mock', id: 'sample-1' });
    expect(store().isOpen(A)).toBe(true);
  });

  it('未保存编辑标记按作用域隔离并可清除', () => {
    expect(store().isDirty(A)).toBe(false);
    store().setDirty(A, true);
    expect(store().isDirty(A)).toBe(true);
    expect(store().isDirty(B)).toBe(false);
    store().setDirty(A, false);
    expect(store().isDirty(A)).toBe(false);
  });

  it('生成中关闭会抑制该作业完成，但不会抑制另一作业', () => {
    store().autoOpen(A, 'workflow:1', { kind: 'generating' });
    store().close(A);
    store().autoOpen(A, 'workflow:1', { kind: 'draft', id: 'completed' });
    expect(store().isOpen(A)).toBe(false);
    store().autoOpen(A, 'workflow:2', { kind: 'generating' });
    expect(store().isOpen(A)).toBe(true);
    store().finish(A, 'workflow:1');
    expect(store().isOpen(A)).toBe(true);
    store().finish(A, 'workflow:2');
    expect(store().isOpen(A)).toBe(false);
  });

  it('关闭生成中 token 不抑制完成后的 done token（右侧应自动打开文书）', () => {
    store().autoOpen(A, 'agent-material:t1:a1:pending', { kind: 'generating' });
    store().close(A);
    expect(store().isOpen(A)).toBe(false);
    store().autoOpen(A, 'agent-material:t1:a1:done:doc-1', { kind: 'mock', id: 'doc-1' });
    expect(store().isOpen(A)).toBe(true);
    expect(store().selectionOf(A)).toEqual({ kind: 'mock', id: 'doc-1' });
  });

  it('物化 publish token 可在任务仍显示生成中时打开正文', () => {
    store().autoOpen(A, 'agent-material:t1:a1:pending', { kind: 'generating' });
    store().autoOpen(A, 'agent-publish:doc-sr-1', { kind: 'mock', id: 'doc-sr-1' });
    expect(store().isOpen(A)).toBe(true);
    expect(store().selectionOf(A)).toEqual({ kind: 'mock', id: 'doc-sr-1' });
    expect(store().scopes[A]?.generating).toBe(false);
  });

  it('后台产物不能替换正在编辑的选择', () => {
    store().select(A, { kind: 'mock', id: 'editing' });
    store().setDirty(A, true);
    store().autoOpen(A, 'workflow:new', { kind: 'mock', id: 'background' });
    expect(store().selectionOf(A)).toEqual({ kind: 'mock', id: 'editing' });
  });
});
