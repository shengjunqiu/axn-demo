import { useState } from 'react'
import { Drawer } from 'antd'
import { Cite, Prose, SourceList } from '@/components/common/ChatPrimitives'
import { workflowSources, reportsInRange } from '../logic/empowerment'
import type { EmpowermentKind, GenerationInput } from '../logic/empowerment'

/** 与聊天标准控件“来源引用”一致：陈述角标、编号来源卡、原文抽屉。 */
export default function WorkflowSources({ kind, input }: { kind: EmpowermentKind; input: GenerationInput }) {
  const sources = workflowSources(kind, input)
  const [detail, setDetail] = useState<(typeof sources)[number] | null>(null)
  const cite = (title: string) => {
    const index = sources.findIndex(s => s.title === title)
    return index >= 0 ? <Cite n={index + 1} /> : null
  }
  return <div className="axn-workflow-source-reference" data-testid="v2-source-reference">
    <Prose>
      <p>本次结果关联当前事件信息{cite('当前事件信息')}。
        {kind === 'resources' || kind === 'orders' ? <>按历史队伍记录与本次需求筛选{input.radius}公里内的候选，实时可调用状态待核验{cite('指令下发队伍列表')}{cite('本次任务与筛选需求')}。</> : null}
        {kind === 'resources' || kind === 'plan' ? <>物资缺口采用现有台账与下一阶段需求记录{cite('物资台账与下一阶段需求')}。</> : null}
        {kind === 'plan' ? <>方案沿用原五章结构，并结合现场任务与最新反馈整理{cite('原处置方案模板')}{cite('现场任务记录')}{sources.map((s, i) => s.section.startsWith('r5 ·') ? <Cite key={s.section} n={i + 1} /> : null)}。</> : null}
        {kind === 'summary' ? <>本次统计范围内共有{reportsInRange(input).length}条现场反馈{sources.map((s, i) => /^r\d+ ·/.test(s.section) ? <Cite key={s.section} n={i + 1} /> : null)}，累计值不重复相加。</> : null}
        {input.supplement.trim() ? <>对话补充作为待核实材料引用{cite('用户对话补充')}。</> : null}
      </p>
      <SourceList sources={sources} onOpen={index => setDetail(sources[index])} />
    </Prose>
    <Drawer title="依据原文" open={!!detail} onClose={() => setDetail(null)} size="100%">
      {detail ? <div className="axn-controls-drawer"><h4>《{detail.title}》</h4><span className="axn-controls-meta">{detail.section}</span><blockquote style={{ whiteSpace: 'pre-wrap' }}>{detail.excerpt}</blockquote><p className="axn-empowerment-source">以上为本地模拟记录或当前需求文本，不代表已取得外部正式预案原文。</p></div> : null}
    </Drawer>
  </div>
}
