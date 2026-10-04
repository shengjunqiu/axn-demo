/**
 * 抢险救援知识问答（qa.json 接入）测试：
 * 数据完整性、规则匹配（精确/双向包含/不误吞业务短句）、意图识别、模拟溯源卡字段。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ensureQaLoaded,
  getQaItem,
  loadedQaItems,
  matchQa,
  normalizeQaText,
  qaStatusLabel,
} from '@/services/qaKnowledge';
import { WELCOME_QUESTION_QA_IDS, WELCOME_QUESTIONS } from '@/seed/welcomeQuestions';
import { recognize } from '@/services/mock/provider';
import { useSessionStore } from '@/store/sessionStore';

// 问答语料改为按需加载（不进首屏）：本文件直接同步调用 recognize/matchQa，需先备好语料。
await ensureQaLoaded();
const qaItems = loadedQaItems();

describe('qa.json 数据完整性', () => {
  it('首页引导问题与 qa.json 原问题一致（ChatPanel 内联副本不得漂移）', () => {
    // ChatPanel 的引导问题内联为字面量（避免整包语料进首屏），这里守住它与语料的一致性。
    expect(WELCOME_QUESTIONS).toEqual(WELCOME_QUESTION_QA_IDS.map((id) => getQaItem(id)?.question));
  });

  it('126 条问题，每条含答案与至少 1 个模拟文档来源', () => {
    expect(qaItems.length).toBe(126);
    for (const item of qaItems) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.summary.length).toBeGreaterThan(0);
      expect(item.sources.length).toBeGreaterThan(0);
      for (const s of item.sources) {
        expect(s.title).toContain('模拟');
        expect(s.section.length).toBeGreaterThan(0);
      }
    }
  });

  it('id 唯一（重复问题文本允许存在，检索取序号靠前条目）', () => {
    const ids = qaItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('matchQa 规则匹配', () => {
  it('精确命中（标点差异归一化）', () => {
    const hit = matchQa('人员被困时，最快的救人方式是什么');
    expect(hit?.id).toBe(1);
  });

  it('双向包含：用户补前缀/后缀仍可命中', () => {
    const hit = matchQa('请问：人员被困时，最快的救人方式是什么？麻烦解答');
    expect(hit?.id).toBe(1);
  });

  it('不误吞业务短句（主线回归）', () => {
    expect(matchQa('它们谁最快能到')).toBeNull();
    expect(matchQa('生成灾情摘要')).toBeNull();
    expect(matchQa('查询周边救援资源')).toBeNull();
    expect(matchQa('生成应急要情')).toBeNull();
  });

  it('未知问题返回 null（走兜底，不伪装成知识回答）', () => {
    expect(matchQa('今天天气怎么样')).toBeNull();
  });

  it('归一化：空白与中英文标点等效', () => {
    expect(normalizeQaText('怎么破拆？')).toBe(normalizeQaText('怎么破拆'));
  });
});

describe('recognize 意图识别', () => {
  beforeEach(() => {
    useSessionStore.getState().resetAll();
  });

  const ctx = () => ({ lastResourceResultIds: [], candidateResourceIds: [] });

  it('QA 命中优先于含"最快"的资源排序正则', () => {
    const r = recognize('人员被困时，最快的救人方式是什么？', ctx());
    expect(r.intent).toBe('qa_knowledge');
    expect(r.params.qaId).toBe(1);
  });

  it('业务短句不受影响（资源排序/查询）', () => {
    expect(recognize('它们谁最快能到', ctx()).intent).toBe('resource_sort_eta');
    expect(recognize('查询周边救援资源', ctx()).intent).toBe('resource_query');
  });

  it('未命中 QA 的"为什么"仍走知识解释意图', () => {
    expect(recognize('为什么建议等级是三级', ctx()).intent).toBe('knowledge');
  });
});

describe('qaStatusLabel', () => {
  it('模拟状态翻译为界面提示（不包装成真实模型能力）', () => {
    expect(qaStatusLabel('demo_general_guidance_needs_live_data')).toContain('需结合现场实时数据');
    expect(qaStatusLabel('other')).toBe('模拟示例答案');
  });
});
