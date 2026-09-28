# 安小能 Demo · UI 组件冻结契约（供 Worker 使用）

主控已完成的底层（Worker 只消费，不修改）：

## Store API

### useSessionStore（src/store/sessionStore.ts）
- `sessions: Record<string, Session>`；`sessionByEvent: Record<eventId, sessionId>`
- `ensureSessionForEvent(eventId): string`（session id）
- `tasks: Record<taskId, AgentTask>`
- `proposals: Record<sessionId, ProposalRecord>`（`ProposalRecord = { proposal: Proposal; selectedAt: string }`）
- AgentTask: `{ taskId, sessionId, eventId, attempt, attemptId, status: 'running'|'completed'|'failed'|'cancelled'|'waiting_input'|'retrying', intent, displayTitle, steps: TaskStep[], artifacts: TaskArtifact[], textAnswer, error: {errorCode,message,hint}|null, startedAt }`
- TaskStep: `{ stepId, name, status: 'running'|'completed'|'failed', inputSummary?, outputSummary?, sourceRefs?, elapsedMs? }`
- TaskArtifact.payload 判别 union：`{kind:'summary', rows:[{label,value,factId?}], pendingKeys:string[]}` / `{kind:'resource_result', resourceIds:string[], sortedBy:'eta'|'distance'|null, excludedIds:string[]}` / `{kind:'knowledge', chunkIds:string[]}` / `{kind:'proposal', proposalId, version}` / `{kind:'document', documentId, templateCode, mode:'draft_created'|'missing_fields', missingFields?}` / `{kind:'clarification', ...}` / `{kind:'error', errorCode,message,hint,recoverable}`
- `lastResourceResultIds: string[]`、`candidateResourceIds: string[]`、`selectedProposalId/version`、`pendingClarification`
- Proposal: `{ proposalId, version, generatedAt, isMock, notice, knowledgeRefs, sections: [{id,title,text}], candidateResourceIds }`

### useDemoStore（src/store/demoStore.ts）
- `actorId/currentEventId/demoClock/pace/faults/guideStepIndex/globalBanner/storageWarning`
- `getActor(): Actor`；`switchEvent(id)`；`isFaultArmed(id)`；`consumeFault(id): boolean`
- `manualFacts: ManualFactEntry[]`（人工补录事实，factId 形如 `fact-manual-001`，有 sourceRecordId `src-manual-001`、actorName、demoClockAt）
- `applyWaterFeedUpdate()`（触发后演示时钟推进至 21:12，水位 fact 覆盖为 42.35 米）

### useDocumentStore（src/store/documentStore.ts）
- `drafts: Record<documentId, DocumentDraft>`；DocumentDraft 含 `title/templateCode/scopeKind/eventId/shiftId/lifecycle('draft'|'submitted'|'signed'|'archived')/validation:{status,reportId}/freshness/activeRevisionId/revisionCounter/snapshot:SourceSnapshot/working:{content,contentHash,...}`
- DocumentContent: `{ title, templateCode:'EMERGENCY_BRIEF'|'DUTY_DAILY', templateVersion, sections:[{id,heading,paragraphs:[{id,role:'narrative'|'fact-line'|'reference',runs:InlineRun[]}]}], footerNote }`
- InlineRun: `{type:'text',text}` | `{type:'fact',factId,suffix?}` | `{type:'derived',derivedKey,suffix?}` | `{type:'knowledge',chunkId,label}`
- `revisions: Record<revisionId, DocumentRevision>`；DocumentRevision: `{revisionId,documentId,displayVersion:'V1.1',contentSnapshot,factsSnapshot:Record<factId,displayValue>,contentHash,changeNote,submittedBy/submittedAt,signedRecord:{signedByActorId,signedByActorName,signedAt,isSimulated:true,note}|null}`
- `reports: Record<reportId, ValidationReport>`；ValidationReport: `{reportId,documentId,contentHash,contextSnapshotId,rulesetVersion,checkedAt,issues:ValidationIssue[]}`；ValidationIssue: `{ruleId,level:'block'|'warning'|'info',message,sectionId,paragraphId,fieldKey,currentValue,suggestion,suggestionText}`
- action：`addDraft/updateWorkingContent(id,content)/markValidation(id,status,reportId)/saveRevision({documentId,content,sourceSnapshotId,changeNote,createdBy,submitted?})/markSubmitted(revisionId,actorName)/markSigned(revisionId,signedByActorName,actorId)/setLifecycle/setFreshness/updateDraftSnapshot(id,snapshot)/getActiveReport(documentId)/invalidateReportForDocument(documentId)/addAudit(...)/computeContentHash(content)`
- audit: `AuditEvent[] {auditId,action,actor,objectId,version,performedAt,demoClockAt,detail}`

## 服务 API（src/services/*）
- `factDisplay(factId): string`（值+单位；缺来源返回 `（来源缺失）`）；`resolveFact(factId): ResolvedFact|null`（含 sourceLabel/sourceRecordId/verification 等）
- `currentContextVersion(): number`（水位更新后为 2）
- `validateContent({documentId,content,snapshot}): {issues,...}`（不含 reportId/checkedAt）；`applySuggestion(content,paragraphId,suggestionText): DocumentContent`；`RULE_TITLES`
- `buildSnapshot({...}): SourceSnapshot`
- `createEventDocument(sessionId): {ok,documentId?,missingFields,state}`；`createDailyDocument(sessionId)` 同构
- `renderRevision(rev): RenderedDocument`（导出/打印用冻结渲染）
- `openPrintPreview(revisionId|null)`（src/components/doc/PrintView.tsx，已实现）
- `sendMessage(sessionId,{text})` / `cancelTask(taskId)` / `retryTask(taskId)`（src/services/taskRunner.ts）
- `mockProvider`（provider.ts）：意图见 `recognize()`；TaskFault 可恢复错误
- 种子：`src/seed/scenario.ts`（actors/incidentById/teams/warehouses/station/waterObservations/knowledgeById/templates/templateByCode/proposalBlueprint/derivedFactDefinitions/schematicMap/factById/sourceById/getFact/factText/factNumber）、`src/seed/derived.ts`（`computeDerived(key, candidateIds): {value,unit,formula,inputSummary,inputFactIds}`、DERIVED_META）
- 队伍实体字段全部经 factRefs：`t.factRefs.name/peopleCount/excavatorCount/distanceKm/etaMinutes/status/capabilityTags` → 用 getFact/factText/factNumber 取值，禁止写死数字

## 组件契约（Worker 必须实现的 props 签名）

1. `ChatPanel`（src/components/chat/ChatPanel.tsx，默认导出）
   - props: `{ onOpenTab: (tab: 'resource'|'knowledge'|'doc') => void }`
   - 使用 @ant-design/x 的 Sender + Bubble（X 2.9 实际 API，自行核对 node_modules）；输入回车 → `sendMessage(ensureSessionForEvent(currentEventId), {text})`
   - 顶部：当前事件名（factRefs.title）+ 演示时钟 + 引导提示（guideStepIndex 对应步骤）
   - 消息列表渲染：user/assistant 文本气泡；`kind:'task'` 的消息渲染 TaskCard（取 session.tasks[msg.taskId]）
   - TaskCard：步骤列表（running=Spinner、completed=✓+outputSummary、failed=✗）、textAnswer（流式累积显示）、artifact 摘要行（summary=数据行表、resource_result=“查看资源与态势页”按钮→onOpenTab('resource')、proposal=“查看建议”→onOpenTab('knowledge')、document=“打开文书中心”→onOpenTab('doc')）、错误卡（可恢复→重试按钮调 retryTask）、运行中→取消按钮（cancelTask）
   - pendingClarification 存在时：内联补录表单（Input+提交），提交→`sendMessage(sessionId,{text:'报送单位：'+value})`（日报交接事项用 '交接事项：'+value）
   - 底部快捷任务 chips：生成灾情摘要 / 查询周边救援资源 / 它们谁最快能到 / 给我处置建议 / 生成应急要情 / 生成值班日报（点击即 sendMessage）
   - 空会话首屏：安小能欢迎语 + 演示边界说明（模拟数据标识）
   - 全部异步消息用 zustand 订阅，不本地复制状态

2. `ResourcePanel`（src/components/workspace/ResourcePanel.tsx，默认导出）+ `SchematicMap`（同目录）
   - 无 props；数据源：session.lastResourceResultIds/candidateResourceIds + teams/warehouses 种子
   - 布局：上 1/3 SchematicMap（SVG，viewBox 1000x650，riverPath 用 schematicMap.riverPath，事件点=incident.schematicPosition 橙色，队伍=绿色方块，仓库=蓝色三角；候选队伍高亮描边；hover 显示名称；标注“空间示意 · 非真实地图”），下 2/3 资源表格（列：选择框/名称/类型/人数/挖掘机/距离/ETA/状态）；排序按钮组（按 ETA/按距离）；点击表格行 ↔ 地图高亮联动（本地 state selectedResourceId）
   - 底部候选力量 chips（可移除）+ 派生汇总（computeDerived 三项：X 支/X 人/X 台）+ 提示“候选≠已调派”
   - 空态：未查询时显示引导文案

3. `KnowledgePanel`（src/components/workspace/KnowledgePanel.tsx，默认导出）
   - 无 props；展示 selectedProposal（sections 卡片 + knowledgeRefs 可展开知识卡 knowledgeById + notice 模拟声明）；无 proposal 时空态；无候选时 sections 中“拟预置力量”显示占位说明
   - 会话中所有 knowledge artifact 的 chunkId 聚合展示（来源徽标：sourceLabel）

4. `DocCenterPanel`（src/components/workspace/DocCenterPanel.tsx，默认导出）— Worker B
   - 无 props；文档列表（title/template/lifecycle Tag/validation 状态/freshness/版本号）+ 操作
   - 操作流（严格状态机）：新建（模板选择：应急要情/值班日报→createEventDocument/createDailyDocument；缺 missingFields→提示去对话补录）；打开编辑抽屉（DocumentEditor，Tiptap）；重新校核→validateContent(draft.working.content, draft.snapshot)→markValidation+保存 report；问题列表（ValidationPanel，block 红色、warning 橙色；“采用建议”→applySuggestion→updateWorkingContent→自动重校核）；保存版本（saveRevision，changeNote 可选）；提交（需 validation passed 且 report.contentHash===working.contentHash 且 lifecycle==='draft'→markSubmitted+lifecycle='submitted'）；签发（需 submitted+校核通过；当前角色非 commander 时按钮禁用并提示切换指挥员→markSigned+lifecycle='signed'，已签发版本锁定）；历史版本抽屉（VersionDrawer：版本列表+差异对比 diff 字符串+过期标记 freshness==='stale' 时置灰并提示“基于旧数据”）；导出 Word（docxExport.exportRevision(revisionId)）；打印（openPrintPreview(revisionId)）
   - 工作副本改动后：activeReport 失效（invalidateReportForDocument→validation.status='stale'），必须重新校核才能提交/签发
   - 纪要/工作总结：模板预览 Modal（templateByCode 读 sections，只读预览+“演示范围内仅预览”说明）

5. `DocumentEditor`（src/components/doc/DocumentEditor.tsx，默认导出）— Worker B
   - props: `{ documentId: string; open: boolean; onClose: () => void }`
   - Tiptap 3.x（@tiptap/react + @tiptap/starter-kit），自定义 FactChip NodeMarks/Node（atomInline attr factId，渲染 .fact-chip，点击 emit 事件供 SourceDrawer 显示来源）；段落与 DocumentParagraph 一一对应（顺序按 sections 展平）
   - 保存：Tiptap JSON → DocumentContent（text run 合并；fact 节点保留；新增段落生成 id `p-user-N`）→ `updateWorkingContent(documentId, content)` + addAudit('编辑正文')
   - 字段绑定 fact chip 点击 → SourceDrawer；正文可编辑文本（fact 芯片不可编辑内容）
   - 抽屉内 footer：保存按钮 + 校核状态 Tag

6. `SourceDrawer`（src/components/doc/SourceDrawer.tsx，默认导出）— Worker B
   - props: `{ factId: string | null; open: boolean; onClose: () => void }`
   - 展示 resolveFact：值/单位/verification Tag（confirmed 绿/pending 橙/suggested 蓝）/来源系统/表/对象/字段/版本/ capturedAt/manual 时显示人工补录信息（actorName/时间/“人工补录（模拟）”）
   - 底部：来源记录字段表（sourceById(f.sourceRecordId).fields）+ 模拟声明

7. `ValidationPanel`（src/components/doc/ValidationPanel.tsx，默认导出）— Worker B
   - props: `{ documentId: string }`；读取 activeReport；按 level 分组展示 RULE_TITLES 标题；block→红色“阻断签发”、warning→橙色；issue 定位（sectionId 段落高亮跳转需 DocumentEditor 支持，可先显示 section heading）；采用建议按钮（suggestionText 存在时）

8. `VersionDrawer`（src/components/doc/VersionDrawer.tsx，默认导出）— Worker B
   - props: `{ documentId: string; open: boolean; onClose: () => void }`；版本时间线（V major.minor、changeNote、submitted/signed 状态、内容指纹）；两版本选择→diff（逐 section 逐段落文本对比，新增绿/删除红行）；signedRecord 展示（签发人/时间/指纹/模拟声明）；每版本“导出 Word”按钮

9. `src/services/docxExport.ts` — Worker B
   - `exportRevision(revisionId: string): Promise<void>`；用 docx 库（Document/Packer/Paragraph/TextRun/HeadingLevel），renderRevision(rev) 生成；标题居中、节标题 Heading3、段落缩进；页脚 mockNotice + footerNote + 版本号 + contentHash；文件名 `${title}_${version}_${yyyymmdd-hhmm}.docx`；Blob 下载（URL.createObjectURL）；导出前 addAudit('导出 Word')

## 硬性约束
- 严格 TypeScript（strict）；禁止 any/ts-ignore/空函数占位；禁止 console.log
- antd 6.6.5 / @ant-design/x 2.9.0 / @tiptap/* 3.x / docx 9.5.1 实际 API（不确定时先读 node_modules 里的 .d.ts，不要照抄旧版示例）
- 所有业务数据必须带“模拟”标识或由种子事实渲染；不新增依赖；不改 store/services/契约文件；不装依赖
- 组件内长列表用固定高度+滚动；按钮必须有真实行为
- 中文文案；空/加载/错误态齐全
