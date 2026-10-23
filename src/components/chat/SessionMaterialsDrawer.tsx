/**
 * 会话资料抽屉：对齐 Vue 辅助区「资料」Tab（勾选 / 查看 / 移除本次补充）。
 */
import { Button, Checkbox, Drawer, Empty, Typography } from 'antd';
import { useSessionStore } from '@/store/sessionStore';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';

export interface SessionMaterialsDrawerProps {
  open: boolean;
  sessionId: string | undefined;
  eventId: string;
  onClose: () => void;
}

export default function SessionMaterialsDrawer({
  open,
  sessionId,
  eventId,
  onClose,
}: SessionMaterialsDrawerProps) {
  const materials = useSessionStore(s =>
    sessionId ? (s.sessions[sessionId]?.materials ?? []) : [],
  );
  const vue = vueWorkspaceEventById.get(eventId);
  const baseline = vue
    ? [
        { name: '事件说明（演示）', text: vue.description, status: '事件台账 · 只读' },
        {
          name: '人装/资源备注（演示）',
          text: vue.resourcesNote || '实际人装与到场记录未取得。',
          status: '事件台账 · 只读',
        },
      ]
    : [];

  return (
    <Drawer
      title="会话资料"
      open={open}
      onClose={onClose}
      width={380}
      destroyOnHidden
      data-testid="session-materials-drawer"
    >
      <Typography.Paragraph type="secondary" className="axn-materials-hint">
        选择本次使用的资料。未选或缺失的信息会保留为待补，不自动补造。本机上传仅登记文件名或可读文本，不解析真实 Word。
      </Typography.Paragraph>

      {baseline.length > 0 && (
        <div className="axn-materials-section">
          <Typography.Text strong>事件基线（只读）</Typography.Text>
          {baseline.map(item => (
            <div key={item.name} className="axn-material-card">
              <strong>{item.name}</strong>
              <small>{item.status}</small>
              <details>
                <summary>查看资料</summary>
                <p>{item.text}</p>
              </details>
            </div>
          ))}
        </div>
      )}

      <div className="axn-materials-section">
        <Typography.Text strong>本次补充</Typography.Text>
        {!materials.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无补充资料，可在输入区点击回形针添加" />
        ) : (
          materials.map(item => (
            <div key={item.id} className="axn-material-card" data-testid={`session-material-${item.id}`}>
              <label className="axn-material-card-head">
                <Checkbox
                  checked={item.selected}
                  disabled={!sessionId}
                  onChange={e => {
                    if (!sessionId) return;
                    useSessionStore.getState().toggleSessionMaterial(sessionId, item.id, e.target.checked);
                  }}
                />
                <strong>{item.name}</strong>
              </label>
              <small>{item.status} · {item.kind}</small>
              <details>
                <summary>查看资料</summary>
                <p>{item.content || '当前仅登记文件名，请在对话中粘贴正文。'}</p>
              </details>
              {item.kind === '本次补充' && sessionId && (
                <Button
                  size="small"
                  type="link"
                  danger
                  onClick={() => useSessionStore.getState().removeSessionMaterial(sessionId, item.id)}
                >
                  移除
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
