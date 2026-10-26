import { describe, expect, it } from 'vitest';
import {
  originalDestinationLabel,
  originalSystemTitle,
  originalTarget,
} from '@/services/originalSystem';

describe('原系统命名（避免仅写「一期」）', () => {
  it('按钮目的地文案含系统正式名称与栏目', () => {
    const [system, page] = originalTarget('RESCUE_PLAN');
    expect(system).toBe('coordination');
    expect(page).toBe('S03');
    const label = originalDestinationLabel(system, page);
    expect(label).toContain('应急救援综合协调保障系统');
    expect(label).toContain('现场处置行动方案管理');
    expect(label).not.toContain('一期');
  });

  it('综合业务系统正式标题', () => {
    expect(originalSystemTitle('business')).toBe('综合业务管理系统');
    const [system, page] = originalTarget('资源维护与导出');
    expect(originalDestinationLabel(system, page)).toContain('综合业务管理系统');
  });
});
