import { describe, expect, it } from 'vitest'
import { INITIAL_GENERATION_INPUT, adjustGenerationRequest, candidateReview, generateDraft, matchingTeams, parseTeamConditions, validateGeneration, workflowSources } from '@/pages/v2/logic/empowerment'

describe('V2四场景赋能边界', () => {
  it('保留所有候选记录，逐项展示不推荐原因，无匹配时也不丢失清单', () => {
    const list = candidateReview('300', '')
    expect(list).toHaveLength(3)
    expect(list.filter(t => t.recommended).map(t => t.id)).toEqual(['yongxin'])
    expect(list[0].reason).toContain('已返营')
    expect(list[0].reason).toContain('超出300公里')
    expect(list[2].reason).toContain('无可调人数')
    expect(candidateReview('100', '20')).toHaveLength(3)
    expect(candidateReview('100', '20').some(t => t.recommended)).toBe(false)
  })
  it('来源按功能和统计范围生成，不将未引用或未接入资料列作依据', () => {
    const sources = workflowSources('summary', { ...INITIAL_GENERATION_INPUT, end: '2026-09-05T18:00' })
    expect(sources.some(s => s.section.startsWith('r1 ·'))).toBe(true)
    expect(sources.some(s => s.section.startsWith('r5 ·'))).toBe(false)
    expect(sources.some(s => /队伍|物资|微信|预案/.test(s.title))).toBe(false)
    expect(workflowSources('orders', INITIAL_GENERATION_INPUT).some(s => s.title === '指令下发队伍列表')).toBe(true)
    expect(workflowSources('resources', INITIAL_GENERATION_INPUT).some(s => s.title === '物资台账与下一阶段需求')).toBe(true)
    expect(workflowSources('plan', INITIAL_GENERATION_INPUT).some(s => s.title === '原处置方案模板')).toBe(true)
  })
  it('自然语言调整保留未修改条件，歧义与未支持条件不能静默忽略', () => {
    expect(parseTeamConditions('200公里内，每队至少10人', { radius: '300', people: '5' })).toEqual({ radius: '200', people: '10' })
    expect(parseTeamConditions('每队至少15人', { radius: '200', people: '10' })).toEqual({ radius: '200', people: '15' })
    expect(parseTeamConditions('增加人数', { radius: '200', people: '10' }).error).toBeTruthy()
    expect(parseTeamConditions('200公里内且有挖掘机', { radius: '300', people: '10' }).error).toBeTruthy()
  })
  it('人数和范围硬约束不放宽，已返营和无可调人数不推荐', () => {
    expect(matchingTeams('500', '10').map(t => t.id)).toEqual(['yongxin'])
    expect(matchingTeams('100', '10')).toEqual([])
    expect(matchingTeams('300', '19')).toEqual([])
    expect(validateGeneration({ ...INITIAL_GENERATION_INPUT, radius: '0' }, 'resources')).toBeTruthy()
    expect(validateGeneration(INITIAL_GENERATION_INPUT, 'orders')).toBe('')
  })
  it('四场景都能直接用已有上下文生成，不强制新增输入', () => {
    for (const kind of ['resources', 'orders', 'plan', 'summary'] as const) {
      expect(validateGeneration(INITIAL_GENERATION_INPUT, kind)).toBe('')
      expect(generateDraft(kind, INITIAL_GENERATION_INPUT).every(s => !!s.body)).toBe(true)
    }
  })
  it('对话直接更新筛选与统计时间，非法条件保留原结果', () => {
    expect(adjustGenerationRequest('orders', '200公里内、每队至少10人', INITIAL_GENERATION_INPUT).input).toMatchObject({ radius: '200', people: '10' })
    expect(adjustGenerationRequest('orders', '100公里内', INITIAL_GENERATION_INPUT).input).toMatchObject({ radius: '100', people: '' })
    expect(adjustGenerationRequest('summary', '截止2026-09-05 18:00', INITIAL_GENERATION_INPUT).input?.end).toBe('2026-09-05T18:00')
    expect(adjustGenerationRequest('summary', '截止2026-02-30 18:00', INITIAL_GENERATION_INPUT).error).toBeTruthy()
    expect(adjustGenerationRequest('orders', '至少20人且有挖掘机', INITIAL_GENERATION_INPUT).input).toBeUndefined()
    expect(adjustGenerationRequest('plan', '重点说明夜间安全保障', INITIAL_GENERATION_INPUT).input?.supplement).toContain('夜间安全保障')
  })
  it('需求不明时只生成候选，不能宣称满足任务', () => {
    expect(generateDraft('resources', INITIAL_GENERATION_INPUT)[2].body).toContain('需求量不明')
  })
  it('总结按统计范围取证据，避免引用范围外结论', () => {
    const early = { ...INITIAL_GENERATION_INPUT, end: '2026-09-05T18:00' }
    const body = generateDraft('summary', early).map(s => s.body).join('\n')
    expect(body).toContain('【r1 ')
    expect(body).not.toContain('【r5 ')
    expect(body).not.toContain('累计救出12人')
    expect(generateDraft('summary', { ...early, end: '2026-09-05T01:00' })[0].body).toContain('未取得过程记录')
    expect(validateGeneration({ ...early, start: '2026-09-08T00:00' }, 'summary')).toBeTruthy()
  })
})
