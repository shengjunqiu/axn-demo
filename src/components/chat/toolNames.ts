/**
 * 工具调用名（执行日志页签用）。
 *
 * 执行日志里的「工具调用」按真实运行日志的样子显示 —— 英文工具名 + 入参，
 * 而任务步骤本身存的是中文名（任务卡里仍然显示中文，不改业务数据）。
 * 这里只做一层展示映射：查得到就用英文工具名，查不到退回 run_step。
 */
const TOOL_NAMES: Record<string, string> = {
  '读取事件上下文': 'read_incident_context',
  '汇总结构化事实': 'aggregate_structured_facts',
  '生成灾情摘要卡片': 'render_summary_card',
  '确定查询范围': 'resolve_query_scope',
  '过滤可用状态': 'filter_available_resources',
  '组装结果并按预计到达排序': 'rank_by_eta',
  '解析指代': 'resolve_anaphora',
  '解析待加入队伍': 'resolve_teams',
  '写入候选清单（拟预置）': 'write_candidate_list',
  '从候选清单移除': 'remove_candidate',
  '定位候选队伍': 'locate_candidate_teams',
  '检索知识包': 'search_knowledge_pack',
  '检索抢险救援知识库': 'search_rescue_kb',
  '读取事件事实与候选': 'read_facts_and_candidates',
  '匹配知识包': 'match_knowledge_chunks',
  '组装处置建议（待审核）': 'draft_proposal',
  '校验必填字段': 'validate_required_fields',
  '校验日报必填字段': 'validate_daily_fields',
  '固化事实快照': 'freeze_fact_snapshot',
  '生成可编辑工作副本': 'create_working_copy',
  '生成日报工作副本': 'create_daily_copy',
  '统计班次派生事实': 'derive_shift_facts',
  '绑定事件与班次': 'bind_event_shift',
  '识别待补录字段': 'detect_missing_fields',
  '建立模拟来源并确认': 'bind_manual_source',
  '检查关联灾情': 'check_linked_incident',
  '汇总灾情与救援反馈': 'summarize_feedback',
  '对比救援目标与阶段成效': 'compare_goals_outcomes',
  '形成救援效果评估与改进建议': 'build_evaluation_report',
  // 通用 mock 执行日志（seed/mockTrajectory）里的步骤
  '读取预警来源': 'fetch_alert_sources',
  '校验水情监测数据': 'verify_hydro_observations',
  '汇总预警要素': 'extract_alert_elements',
  '查询候选队伍与装备': 'query_resources',
  '计算到场时间': 'estimate_eta',
  '核对装备库存': 'check_inventory',
  '生成到场顺序清单': 'rank_teams_by_eta',
  '检索处置模板与先例': 'search_knowledge',
  '组装处置要点': 'compose_response_points',
  '生成文书草稿': 'write_document',
  '拉取响应时间线': 'fetch_response_timeline',
  '比对预案时限要求': 'compare_plan_sla',
  '生成复盘结论': 'build_review_report',
  '汇总本日交互与产出': 'collect_session_outputs',
  '套用值班日报模板': 'apply_daily_template',
};

export function toolNameFor(stepName: string): string {
  return TOOL_NAMES[stepName] ?? 'run_step';
}

/** 入参照日志写成 JSON 参数；真实任务是临时拼的，没有结构化入参就留空对象。 */
export function callArgs(args: string | undefined): string {
  return args ?? '{}';
}
