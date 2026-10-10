import { App, Button } from 'antd';
import { useNavigate, useInRouterContext } from 'react-router-dom';
import {
  originalDestinationLabel,
  originalTarget,
  stageOriginalMaterial,
} from '@/services/originalSystem';

function LinkedButton({
  code,
  eventId,
  title,
  sourceId,
  sections,
  disabled = false,
  /** 工具栏短文案；默认「打开{系统 · 栏目}」 */
  buttonLabel,
  size = 'small',
}: {
  code: string;
  eventId: string;
  title: string;
  sourceId: string;
  sections: readonly (readonly [string, string])[];
  disabled?: boolean;
  buttonLabel?: string;
  size?: 'small' | 'middle' | 'large';
}) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [system, page] = originalTarget(code);
  const destination = originalDestinationLabel(system, page);
  const text = buttonLabel ?? `打开${destination}`;
  return (
    <Button
      size={size}
      disabled={disabled || !eventId || eventId.startsWith('evt-blank-')}
      aria-label={`打开${destination}`}
      title={destination}
      data-testid="original-system-link"
      onClick={() => {
        try {
          navigate(stageOriginalMaterial({ code, eventId, title, sourceId, sections }));
        } catch (error) {
          message.error(
            error instanceof Error ? error.message : '业务系统联动材料保存失败，请重试',
          );
        }
      }}
    >
      {text}
    </Button>
  );
}

export default function OriginalSystemLink(props: Parameters<typeof LinkedButton>[0]) {
  const routed = useInRouterContext();
  return routed ? <LinkedButton {...props} /> : null;
}
