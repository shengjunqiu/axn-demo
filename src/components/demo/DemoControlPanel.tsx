/**
 * 演示控制面板（T-017 一部分）：向客户展示本原型的模拟边界。
 * 包含：角色、事件、演示节奏、故障注入（一次性）、水位更新、引导步骤、审计流水。
 */
import { Alert, App as AntdApp, Button, Descriptions, Divider, Empty, Popconfirm, Space, Switch, Tag, Timeline, Typography } from 'antd';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { useConversationStore } from '@/store/conversationStore';
import { faultScenarios, factText, incidentById } from '@/seed/scenario';

const FAULT_LABEL: Record<string, string> = {
  resource_timeout_once: '资源查询超时（下一次触发）',
  missing_source_once: '生成文书缺来源（下一次触发）',
  water_feed_update: '监测数据更新（推进演示时钟）',
};

function fmtClock(iso: string): string {
  return iso.replace('T', ' ').replace('+08:00', '');
}

export default function DemoControlPanel() {
  const { message } = AntdApp.useApp();
  const resetAll = useSessionStore((s) => s.resetAll);
  const pace = useDemoStore((s) => s.pace);
  const setPace = useDemoStore((s) => s.setPace);
  const faults = useDemoStore((s) => s.faults);
  const armFault = useDemoStore((s) => s.armFault);
  const disarmFault = useDemoStore((s) => s.disarmFault);
  const applyWaterFeedUpdate = useDemoStore((s) => s.applyWaterFeedUpdate);
  const isWaterFeedUpdated = useDemoStore((s) => s.isWaterFeedUpdated());
  const demoClock = useDemoStore((s) => s.demoClock);
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const switchEvent = useDemoStore((s) => s.switchEvent);
  const guideStepIndex = useDemoStore((s) => s.guideStepIndex);
  const setGuideStep = useDemoStore((s) => s.setGuideStep);
  const audit = useDocumentStore((s) => s.audit);
  const actorName = useDemoStore((s) => s.getActor().name);

  // factRefs.title 存的是事实 id，需要通过 factText 解析为展示文本
  const eventLabel = (id: string) => {
    const ref = incidentById.get(id)?.factRefs.title;
    return ref ? factText(ref) : id;
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="本面板仅用于演示控制"
        description="全部数据为模拟数据。故障注入只触发一次，用于展示异常处理与恢复路径。"
      />
      <Divider />
      <Descriptions column={1} size="small">
        <Descriptions.Item label="当前角色">{actorName}</Descriptions.Item>
        <Descriptions.Item label="当前事件">{eventLabel(currentEventId)}</Descriptions.Item>
        <Descriptions.Item label="演示时钟">{fmtClock(demoClock)}</Descriptions.Item>
      </Descriptions>
      <Divider>演示节奏</Divider>
      <Space>
        <span>快速模式（模拟回复加速）</span>
        <Switch checked={pace === 'fast'} onChange={(v) => setPace(v ? 'fast' : 'normal')} />
      </Space>
      <Divider>事件切换</Divider>
      <Space>
        {['evt-demo-001', 'evt-demo-002'].map((id) => (
          <Button key={id} size="small" type={currentEventId === id ? 'primary' : 'default'} onClick={() => switchEvent(id)}>
            {eventLabel(id)}
          </Button>
        ))}
      </Space>
      <Divider>故障注入（一次性）</Divider>
      <Space direction="vertical" style={{ width: '100%' }}>
        {faultScenarios.map((f: { faultId: string }) => {
          if (f.faultId === 'water_feed_update') {
            return (
              <div key={f.faultId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text style={{ flex: 1 }}>{FAULT_LABEL[f.faultId]}</Typography.Text>
                {isWaterFeedUpdated ? <Tag color="green">已触发（21:12 水位 42.35 米）</Tag> : <Button size="small" onClick={() => void applyWaterFeedUpdate()}>立即触发</Button>}
              </div>
            );
          }
          const armed = faults[f.faultId] ?? false;
          return (
            <div key={f.faultId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch size="small" checked={armed} onChange={(v) => (v ? armFault(f.faultId) : disarmFault(f.faultId))} />
              <Typography.Text style={{ flex: 1 }}>{FAULT_LABEL[f.faultId] ?? f.faultId}</Typography.Text>
              {armed && <Tag color="orange">已布防</Tag>}
            </div>
          );
        })}
      </Space>
      <Divider>客户演示引导</Divider>
      <Timeline
        items={GUIDE_STEPS.map((g, i) => ({
          color: i < guideStepIndex ? 'green' : i === guideStepIndex ? 'blue' : 'gray',
          children: (
            <span
              style={{ cursor: 'pointer', fontWeight: i === guideStepIndex ? 600 : 400 }}
              onClick={() => setGuideStep(i)}
            >
              {g.title} —— {g.hint}
            </span>
          ),
        }))}
      />
      <Space>
        <Button size="small" type="primary" onClick={() => setGuideStep(Math.min(guideStepIndex + 1, GUIDE_STEPS.length))}>
          标记当前步完成
        </Button>
        <Button size="small" onClick={() => setGuideStep(0)}>
          重置引导
        </Button>
      </Space>
      <Divider>审计流水（模拟）</Divider>
      {audit.length === 0 ? (
        <Empty description="暂无审计记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ maxHeight: 220, overflow: 'auto', fontSize: 12 }}>
          {audit.slice(0, 12).map((a) => (
            <div key={a.auditId} style={{ padding: '4px 0', borderBottom: '1px dashed #eee' }}>
              <Tag style={{ fontSize: 11 }}>{fmtClock(a.demoClockAt)}</Tag>
              {a.actor} · {a.action} · {a.objectId}
              {a.version ? ` · ${a.version}` : ''}
            </div>
          ))}
        </div>
      )}
      <Divider />
      {/* 审查 M-10：重置为破坏性操作，需二次确认（FR-016）。 */}
      <Popconfirm
        title="确认重置演示？"
        description="将清空会话、任务、候选、文书、版本与审计记录（模拟环境不落盘）。"
        okText="确认重置"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onConfirm={() => {
          resetAll();
          useConversationStore.getState().resetAll();
          message.success('演示已重置：会话、文书、版本与审计均已清空（模拟）');
        }}
      >
        <Button danger block>
          重置演示（清空全部演示状态）
        </Button>
      </Popconfirm>
    </div>
  );
}

const GUIDE_STEPS: { title: string; hint: string }[] = [
  { title: '灾情摘要', hint: '对安小能说“生成当前事件灾情摘要”' },
  { title: '查询周边救援资源', hint: '“查询周边救援资源”' },
  { title: '连续追问', hint: '“它们谁最快能到？”' },
  { title: '选择候选力量', hint: '“选择前两支队伍”或在资源页点选' },
  { title: '查看处置建议', hint: '“给我处置建议”查看依据' },
  { title: '生成应急要情', hint: '“生成应急要情”，缺项时按提示补录报送单位' },
  { title: '编辑与溯源', hint: '在文书中心编辑正文、点击数据查看来源' },
  { title: '校核与修改', hint: '重新校核，查看问题并采用修改建议' },
  { title: '版本与签发', hint: '保存版本、提交，切换指挥员模拟签发' },
  { title: '导出与打印', hint: '导出真实 Word，打印 / 另存为 PDF' },
];
