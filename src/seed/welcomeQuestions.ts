/**
 * 首页引导问题：qa.json 中 id 38/43/16/67 的原问题（点击后命中对应知识答案）。
 *
 * 这里内联为字面量而不是从语料里取，是因为整包 qa.json（min 236 KB / gzip ≈45 KB）
 * 不进首屏——引导问题是首屏 UI 的一部分，若从语料取值就会把语料拉回入口包。
 * 与 qa.json 的一致性由 src/tests/qaKnowledge.test.ts 的漂移断言守住：改语料时该断言会失败提醒。
 */
export const WELCOME_QUESTION_QA_IDS = [38, 43, 16, 67] as const;

export const WELCOME_QUESTIONS: string[] = [
  '堤防管涌、渗漏、滑坡等险情有哪些识别征兆？对应的抢护方法是什么？',
  '如何利用水位、流量等监测数据动态调整抢险方案？',
  '有没有可以安全抵达灾害现场的路线？',
  '溺水人员现场急救的步骤是什么？',
];
