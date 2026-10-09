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
}: {
  code: string;
  eventId: string;
  title: string;
  sourceId: string;
  sections: readonly (readonly [string, string])[];
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [system, page] = originalTarget(code);
  const label = originalDestinationLabel(system, page);
  return (
    <Button
      size="small"
      disabled={disabled || !eventId || eventId.startsWith('evt-blank-')}
      aria-label={`打开${label}`}
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
      打开{label}
    </Button>
  );
}

export default function OriginalSystemLink(props: Parameters<typeof LinkedButton>[0]) {
  const routed = useInRouterContext();
  return routed ? <LinkedButton {...props} /> : null;
}
