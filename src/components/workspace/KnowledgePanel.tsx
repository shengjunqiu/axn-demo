/**
 * 建议与知识页（T-010 UI 部分）：处置建议卡（含采纳/取消采纳）+ 会话内知识产物聚合 + 知识卡。
 * 数据源：session.selectedProposalId → store.proposals；knowledge artifact.chunkIds → knowledgeById；
 * 无候选力量时“拟预置力量”小节显示占位说明（候选 ≠ 已调派）。全部为模拟数据。
 */
import { useMemo } from 'react';
import { Alert, Button, Card, Empty, Space, Tag, Typography } from 'antd';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { sendMessage } from '@/services/taskRunner';
import { factText, knowledgeById, teamById } from '@/seed/scenario';
import './workspace.css';

const { Text, Paragraph } = Typography;

export default function KnowledgePanel() {
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const session = useSessionStore((s) => s.sessions[s.sessionByEvent[currentEventId] ?? '']);
  const tasks = useSessionStore((s) => s.tasks);
  // 展示优先级：已采纳建议 > 本会话最近生成的建议（生成后即使未采纳也可查看/采纳）
  const latestProposalId = useMemo(() => {
    if (!session) return null;
    let latest: { id: string; createdAt: string } | null = null;
    for (const m of session.messages) {
      if (m.kind !== 'task' || !m.taskId) continue;
      const task = tasks[m.taskId];
      if (task?.sessionId !== session.sessionId) continue;
      for (const artifact of task.artifacts) {
        if (artifact.payload.kind === 'proposal') {
          const record = useSessionStore.getState().proposals[artifact.payload.proposalId];
          if (record && (!latest || record.createdAt >= latest.createdAt)) {
            latest = { id: record.proposalId, createdAt: record.createdAt };
          }
        }
      }
    }
    return latest?.id ?? null;
  }, [session, tasks]);
  const proposalRecord = useSessionStore((s) =>
    session ? s.proposals[session.selectedProposalId ?? latestProposalId ?? ''] : undefined,
  );

  // 会话内所有 knowledge artifact 的 chunkId 聚合 + 已选建议的 knowledgeRefs
  const knowledgeIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of session?.messages ?? []) {
      if (m.kind !== 'task' || !m.taskId) continue;
      const task = tasks[m.taskId];
      for (const artifact of task?.artifacts ?? []) {
        if (artifact.payload.kind === 'knowledge') {
          for (const chunkId of artifact.payload.chunkIds) set.add(chunkId);
        }
      }
    }
    for (const ref of proposalRecord?.knowledgeRefs ?? []) set.add(ref);
    return [...set];
  }, [session?.messages, tasks, proposalRecord]);

  const busy = useMemo(
    () =>
      Object.values(tasks).some(
        (t) => t.sessionId === session?.sessionId && (t.status === 'running' || t.status === 'queued'),
      ),
    [tasks, session?.sessionId],
  );

  if (!session) {
    return <Alert type="error" showIcon message="会话未初始化" description="请稍候或重置演示后重试（模拟数据）。" />;
  }

  const askProposal = () => {
    if (busy) return;
    void sendMessage(session.sessionId, { text: '给我处置建议' });
  };

  const proposalStale = !!proposalRecord && (proposalRecord.eventId !== session.eventId
    || [...proposalRecord.candidateIds].sort().join('|') !== [...session.candidateResourceIds].sort().join('|'));
  const selected = !!proposalRecord && session.selectedProposalId === proposalRecord.proposalId && !proposalStale;

  return (
    <div className="axn-knowledge-panel">
      <div className="axn-panel-head">
        <Space size={8} align="center">
          <Text strong>处置建议与知识依据</Text>
          <Tag color="orange">模拟数据</Tag>
        </Space>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 14px' }}>
        {/* 处置建议 */}
        {proposalRecord ? (
          <Card
            size="small"
            title={
              <Space size={6} wrap>
                <span>{proposalRecord.title}</span>
                <Tag color="blue">{proposalRecord.version}</Tag>
                <Tag color="orange">模拟生成</Tag>
                {selected && <Tag color="success">已采纳</Tag>}
                {proposalStale && <Tag color="warning">候选已变化 · 建议过期</Tag>}
              </Space>
            }
            extra={
              selected ? (
                <Button
                  size="small"
                  onClick={() => selectProposalSafe(session.sessionId, null)}
                >
                  取消采纳
                </Button>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  disabled={proposalStale}
                  onClick={() => selectProposalSafe(session.sessionId, proposalRecord.proposalId)}
                >
                  采纳为当前建议
                </Button>
              )
            }
            style={{ marginBottom: 12 }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 10 }}
              message="本建议由规则模拟生成，仅供演示，需人工审核确认后方可作为处置依据。"
            />
            {proposalStale && <Alert type="warning" showIcon style={{ marginBottom: 10 }}
              message="下列为原候选集合生成的历史建议，不能作为当前建议采纳。"
              action={<Button size="small" disabled={busy} onClick={askProposal}>重新生成建议</Button>} />}
            {proposalRecord.sections.map((section) => {
              const boundTeamNames = (section.bindingResourceIds ?? [])
                .map((id) => {
                  const team = teamById.get(id);
                  return team ? factText(team.factRefs.name) || id : null;
                })
                .filter((n): n is string => n != null);
              const showPlaceholder = section.id === 'resources' && boundTeamNames.length === 0;
              return (
                <div key={section.id} style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    {section.title}
                  </Text>
                  <Paragraph style={{ marginBottom: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {section.text}
                  </Paragraph>
                  {showPlaceholder ? (
                    <div className="axn-proposal-empty">
                      <Tag color="gold">候选 ≠ 已调派</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {section.emptyText ?? '尚未指定候选力量，请先在“资源与态势”页选择候选。'}
                      </Text>
                    </div>
                  ) : (
                    boundTeamNames.length > 0 && (
                      <Space size={4} wrap>
                        {boundTeamNames.map((name) => (
                          <Tag key={name} color="green">
                            {name}
                          </Tag>
                        ))}
                      </Space>
                    )
                  )}
                </div>
              );
            })}
            <div>
              <Text strong style={{ fontSize: 13 }}>
                风险提示
              </Text>
              <ul className="axn-risk-list">
                {proposalRecord.riskNotes.map((note) => (
                  <li key={note}>
                    <Text style={{ fontSize: 12 }}>{note}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ) : (
          <Card size="small" style={{ marginBottom: 12 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  尚无处置建议。
                  <br />
                  可在对话中发送“给我处置建议”生成（模拟）。
                </span>
              }
            >
              <Button size="small" type="primary" disabled={busy} onClick={askProposal}>
                生成处置建议
              </Button>
            </Empty>
          </Card>
        )}

        {/* 知识依据 */}
        <Card size="small" title={<Space size={6}>相关依据与知识 <Tag>共 {knowledgeIds.length} 条</Tag></Space>}>
          {knowledgeIds.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="会话中还没有知识引用；发送“解释依据与术语”或生成建议后，这里会展示依据卡片（模拟数据）。"
            />
          ) : (
            knowledgeIds.map((chunkId) => {
              const chunk = knowledgeById.get(chunkId);
              if (!chunk) {
                return (
                  <Alert
                    key={chunkId}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                    message={`知识条目缺失：${chunkId}（模拟数据）`}
                  />
                );
              }
              return (
                <Card key={chunk.chunkId} type="inner" size="small" style={{ marginBottom: 8 }}
                  title={
                    <Space size={6} wrap>
                      <span>{chunk.title}</span>
                      <Tag>{chunk.category}</Tag>
                      <Tag>{chunk.version}</Tag>
                      <Tag color="geekblue">{chunk.sourceLabel}</Tag>
                    </Space>
                  }
                >
                  <Paragraph style={{ marginBottom: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {chunk.content}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {chunk.notice}
                  </Text>
                </Card>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}

/** 采纳/取消采纳（包装一层，避免 JSX 中直接内联长调用） */
function selectProposalSafe(sessionId: string, proposalId: string | null): void {
  useSessionStore.getState().selectProposal(sessionId, proposalId);
}
