/**
 * 原系统联动入口（「打开应急救援综合协调保障系统 · …」等）。
 * 产品演示阶段统一隐藏；调用方与 stageOriginalMaterial 服务仍保留，便于后续恢复。
 */
export default function OriginalSystemLink(_props: {
  code: string;
  eventId: string;
  title: string;
  sourceId: string;
  sections: readonly (readonly [string, string])[];
  disabled?: boolean;
  buttonLabel?: string;
  size?: 'small' | 'middle' | 'large';
}) {
  return null;
}
