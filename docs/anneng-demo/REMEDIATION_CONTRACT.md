# 2026-09-29 整改契约与写入审计

本轮以用户整改指令和正式验收报告为准，不改变产品/AC/fixture标准。DELIVERY.md 的单写入者规则继续有效：同一时刻只允许一个 writer，其他 Agent 只读。主控维护 domain、Store API、此契约；Worker 不改依赖、不启动服务、不提交或部署。

## 阶段闸门

1. 状态隔离 D03/D04/D06：定向回归通过后才进入2。
2. 候选唯一状态 D05与建议/文书读取一致：定向回归通过后才进入3。
3. 文书可信链 D01/D02：编辑/快照/校核/签发/输出门禁通过后进入4。
4. pending续办、版本/diff、签发确认。
5. 趋势、来源附录、打印/单位等主线P1；全量验证与AC复验。

## 第一阶段冻结接口

- `taskRuns.ts`为非持久化run注册表，identity=`taskId + attemptId + eventId + sessionId`。`registerRun(run,onCancel)`、`isActiveRun(taskId,attemptId)`、`finishRun`、`invalidateRun`、`invalidateAllRuns`。注册表先删除再abort/callback，旧run永远不可重新有效。
- demo `switchEvent/reset`、session `ensureSessionForEvent/switchSession/resetAll`使所有活动run失效。callback负责立即标记cancelled与结束子步骤。runner所有事件及provider业务副作用均必须检查active identity，不能仅判断signal。
- `session.beginAttempt(taskId)`创建唯一attemptId，推进attempt、清错误/当次步骤，拒绝活动/成功任务重试。`applyTaskEvent(taskId,event,attemptId)`拒收旧attempt与终态任务；runner必须传第三参。
- 人工事实ID使用`crypto.randomUUID()`，明确field/scopeKind/scopeId/eventId/sourceRecordId。旧持久化数据需要验证/处理冲突，不按数组位置推断业务字段。
- 原fixture有event、organization、shift作用域。禁止B读取A的事件事实；共享资源只按allowedEventIds授权；日报允许明确shift范围内事件集合，不能默认全局查询。不得为满足event_id要求伪造fixture归属。
- Worker A获准设计并实现`resolveFact`的显式查询作用域及`latestWaterLevelFactId(eventId)`；保持调用兼容并修正实际调用者。报告新增签名，主控复核冻结。此授权不包含文书生命周期API修改。

## 单writer交接记录

- 08:50～08:55：主控writer，Worker A/B只读。主控增加run registry、UUID人工事实、Store取消与attempt API。
- 下一writer：Worker A，仅阶段1服务/测试；主控及Worker B只读。具体scope通过Herdr下发。Worker完成必须列文件/定向测试/剩余风险并明确释放writer。

## 状态

阶段1闸门重新打开：此前主控40/40定向测试、typecheck通过；独立复核发现来源UI遗漏显式scope与事件接口可省略attempt，需要补齐。阶段2 PAUSED；阶段3～5 NOT STARTED。旧验收报告保留原样，不以实施声明替代实测。

## 第二阶段冻结接口与交接
- 主控维护候选Store：toggle委托addCandidates/removeCandidate，add校验授权+available，唯一状态为session.candidateResourceIds。候选变化清除已选建议；旧proposal仅历史记录，不能重新采纳不同候选集合的建议。
- Worker B为下一唯一writer，scope为provider/documentFactory/snapshot/KnowledgePanel及新增candidateConsistency测试，只修D05和候选→建议→文书一致性。成功回复必须读取mutation之后的Store，不维护冗余计数。禁止修改Store/domain。
- 不提前实现阶段3校核/签发/快照更新或阶段4pending。

## 用户改动与恢复调度
- 用户确认新增Conversation/NavPage、conversationStore及导航文件为本人改动。全部保留，以当前工作区集成；不扩展本轮整改范围。
- Worker B已释放writer，阶段2修改落盘尚未验收（7项测试6通过1失败）。主控补齐applyTaskEvent必传身份守卫与补录缓存形状检查，随后交Worker A处理阶段1UI作用域及回归。

- 阶段1补充主控复验：44/44定向测试PASS、typecheck退出0、diff-check退出0；日志phase1-recheck.log/phase1-types-recheck.log。第一阶段闸门关闭。
- 阶段2恢复：主控已修无变化候选操作不撤销已选建议；B唯一writer，增加ResourcePanel鼠标排序共享、不可选状态及对应测试scope。

## 第三阶段冻结契约（主控写入）
- 阶段2主控48/48定向测试、typecheck、diff-check PASS，证据phase2-*-final.log。早期集成重复字段已修正，原失败日志保留。
- `FactSnapshotValue.scope`，`SourceSnapshot.sources`完整SourceRecord；`DocumentRevision.sourceSnapshot/validationReportId/locked`；`ValidationReport.revisionId:string|null/factSnapshotVersion:number`。空revisionId预检查报告不能授权。
- demo `getContextVersion(kind,id)`、`touchContext(kind,id)`：单调sequence+按事件/班次键的contextVersions，持久化。人工事实、候选、水位实变才推进；event变化同时使覆盖该event的班次过期。`document.markBusinessDataChanged`只标记未签稿stale，不改历史事实。
- `updateWorkingContent`即时失效校核、submitted退draft；`updateDraftSnapshot`更新working.contextSnapshotId并失效；signed/archived禁止原地写入。
- `saveRevision`只存与当前working完全相同内容/snapshot；相同内容+snapshot幂等返回当前版，新版本冻结完整来源，无实时fallback；submitted参数true不再允许绕过送审。
- `saveCurrentRevision`/`runDocumentValidation`在services/documentLifecycle.ts；校核先存当前版，再对该版contentSnapshot+sourceSnapshot执行，绑定revisionId/hash/snapshotId/dataVersion，markValidation验证binding。采用建议只能stale，必须显式重核。
- `getRevisionGuard(id,submit|sign|export)`为统一门禁。签发需当前actor指挥员+已送审当前revision+PASS绑定+当前业务version。历史signed导出只核对该版完整冻结链，不能要求最新事实或当前working；明确选择已保存草稿可导出该稿，但必须该稿独立PASS且来源未过期。
- `markSubmitted`与`markSigned`原子更新生命周期且重新校验；签发幂等。`beginRevision(documentId,changeNote)`同document建立下一major工作副本，旧signed revision保留不变。禁止setLifecycle直接绕过签发。
- Worker B下一唯一writer，阶段3 scope：factLookup/snapshot/derived/documentFactory/documentFactScope/validation、DocumentEditor/SourceDrawer/ValidationPanel/DocCenterPanel、docRender/docxExport/PrintView仅统一guard、相关新回归+加强旧测试。可新增快照/校核小型纯函数服务，不改domain/store/deps/fixture。
- 必须恢复产品R001～012原编号语义；来源记录/字段/value/scope验证；R010仅narrative的text runs中文数量与阿拉伯数字，其他引用不豁免；必填不可只看快照存在，正文绑定也要在。
- 水位obs006新增事实及来源，005保持原42.3/21:05。显式refresh同步水位、观测、截止时钟引用、候选资源段/建议段，保留用户其他叙述编辑；只刷新未签稿，旧报告失效。
- 编辑器与来源只读draft.snapshot（版本源不随workspace切换或live变化）；DerivedChip不得全局cache，来自该snapshot.derived，派生来源可查看公式+inputFactIds。Fact与Derived支持键盘入口。校核错误提供具体定位。
- 阶段3允许UI接入必要存版/送审/签发guard，签发确认Modal与完整diff展示留阶段4；趋势/附录/打印布局留阶段5。

## 用户要求停止并提交（2026-09-29）

- 按用户最新指令停止整改、测试与验收，仅提交已落盘的本轮修改。两名Worker停止；不继续进入后续阶段。
- 阶段1最后主控定向回归44/44通过；阶段2最后主控定向回归48/48、typecheck、diff-check通过。
- 阶段3为未完成工作快照：Worker曾报告typecheck通过，但主控尚未完成集成复验。Worker停止时报告：documentTrust 23/24通过（“九千万元”R010漏检）；lifecycle/validation/stateIsolation 43/45通过（重复documentId覆盖、历史来源对象可变两个Store失败）。这些最终状态尚未经主控复验，后续UI回归未完成。
- 未完成：任务补录确认/原请求续办、完整版本diff闭环、签发确认Modal、趋势/来源附录/打印版式、全量工程验证、浏览器主线与AC-001～030复验。不得将此提交描述为验收通过或P0清零。
- 保留用户新增导航相关文件及domain尾部Conversation/NavPage模型，不纳入本次整改提交；未部署、未推送。
