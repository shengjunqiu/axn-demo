import { beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/store/demoStore';
import { useConversationStore } from '@/store/conversationStore';
import { useSessionStore } from '@/store/sessionStore';
import { resetDemoData } from '@/store/resetDemo';
import { visibleAgentsForActor } from '@/seed/agentAccess';
import { summonAgentFromManagement, summonAgentInConversation } from '@/services/agentConversation';
import { flushPersist, loadPersist } from '@/store/persistence';

beforeEach(() => resetDemoData());

describe('改版方案与模式', () => {
  it('方案二固定张明远，回到方案一恢复之前账号，重复选择不会覆盖账号', () => {
    const demo = useDemoStore.getState();
    demo.setActor('actor-demo-lilei');
    demo.setDesignPlan('two');
    expect(useDemoStore.getState().getActor().userName).toBe('张明远');
    demo.setActor('actor-demo-commander');
    expect(useDemoStore.getState().getActor().userName).toBe('张明远');
    demo.setDesignPlan('two');
    demo.setDesignPlan('one');
    expect(useDemoStore.getState().getActor().userName).toBe('李雷');
  });

  it('方案二对话模式禁止召唤，工作模式可召唤全部，切回对话后重新禁止', () => {
    const demo = useDemoStore.getState();
    const visible = () => {
      const state = useDemoStore.getState();
      return visibleAgentsForActor(state.actorId, state);
    };
    demo.setDesignPlan('two');
    expect(visible()).toHaveLength(0);
    const conversations = useConversationStore.getState();
    const session = useSessionStore.getState();
    expect(summonAgentFromManagement('agent-doc')).toBeNull();
    expect(summonAgentInConversation(session.currentSessionId, 'agent-doc')).toBeNull();
    expect(useConversationStore.getState()).toBe(conversations);
    expect(useSessionStore.getState()).toBe(session);
    demo.setInteractionMode('work');
    expect(visible()).toHaveLength(5);
    expect(summonAgentFromManagement('agent-resource')?.agentId).toBe('agent-resource');
    demo.setInteractionMode('chat');
    expect(visible()).toHaveLength(0);
    expect(summonAgentFromManagement('agent-resource')).toBeNull();
    demo.setDesignPlan('one');
    expect(visible()).toHaveLength(5);
  });

  it('持久化方案、模式和原账号；重置后回到默认方案一', () => {
    const demo = useDemoStore.getState();
    demo.setActor('actor-demo-commander');
    demo.setDesignPlan('two');
    demo.setInteractionMode('work');
    flushPersist('demo');
    expect(loadPersist('demo')).toMatchObject({
      designPlan: 'two', interactionMode: 'work', actorId: 'actor-demo-duty', planOneActorId: 'actor-demo-commander',
    });
    resetDemoData();
    expect(useDemoStore.getState()).toMatchObject({ designPlan: 'one', interactionMode: 'chat', actorId: 'actor-demo-duty' });
  });
});
