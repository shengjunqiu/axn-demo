/** 方案修订侧 P04-4：安全 / 可行性 / 合规三类规则命中（本地模拟）。 */
export type RuleDimension = 'safety' | 'feasibility' | 'compliance';
export type RuleHitStatus = 'pass' | 'conflict' | 'insufficient';

export type RuleHit = {
  id: string;
  dimension: RuleDimension;
  status: RuleHitStatus;
  clause: string;
  sectionRef: string;
  remedy?: string;
};

const DIMENSION_LABEL: Record<RuleDimension, string> = {
  safety: '安全',
  feasibility: '可行性',
  compliance: '合规',
};

export function ruleDimensionLabel(d: RuleDimension): string {
  return DIMENSION_LABEL[d];
}

export function ruleStatusLabel(s: RuleHitStatus): string {
  if (s === 'pass') return '通过';
  if (s === 'conflict') return '存在冲突';
  return '依据不足';
}

/** 按修订文本与事件风险生成演示命中列表；正式规则引擎待接入。 */
export function checkPlanRules(input: {
  revision: string;
  basis: string;
  risks: string;
  gaps: string;
  forceConflict?: boolean;
}): RuleHit[] {
  const text = `${input.revision}\n${input.basis}`.toLowerCase();
  const riskHint = /触电|渗漏|坍塌|爆炸|有毒|决口|堰塞|失稳/.test(input.risks);
  const gapHint = /缺口|不足|待核|未到位/.test(input.gaps);
  const mentionsSafety = /撤离|警戒|红线|许可|防护/.test(text);
  const mentionsResource = /增援|替补|编组|到位|装备/.test(text);
  const mentionsClause = /预案|条款|版本|规范/.test(text);

  const hits: RuleHit[] = [
    {
      id: 'r-safety-1',
      dimension: 'safety',
      status: input.forceConflict || (riskHint && !mentionsSafety) ? 'conflict' : mentionsSafety ? 'pass' : 'insufficient',
      clause: '现场作业须满足警戒、撤离与作业许可条件',
      sectionRef: '方案·安全与撤收',
      remedy: '补充撤离条件、警戒范围与技术安全核对意见',
    },
    {
      id: 'r-feas-1',
      dimension: 'feasibility',
      status: gapHint && !mentionsResource ? 'conflict' : mentionsResource ? 'pass' : 'insufficient',
      clause: '修订涉及力量调整时须核对可调用资源与到位时限',
      sectionRef: '方案·人装与保障',
      remedy: '写明增援/替补来源、数量单位与预计到位时间',
    },
    {
      id: 'r-comp-1',
      dimension: 'compliance',
      status: mentionsClause ? 'pass' : 'insufficient',
      clause: '修订须引用有效预案版本或已批准变更依据',
      sectionRef: '方案·依据与适用条件',
      remedy: '补充预案名称、版本号或正式变更回执编号',
    },
  ];
  return hits;
}

export function hasRuleConflict(hits: RuleHit[]): boolean {
  return hits.some((h) => h.status === 'conflict');
}
