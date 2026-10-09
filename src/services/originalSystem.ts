import systems from '@/seed/originalSystems.json';
export { systems };

export type OriginalSystemPage = {
  id: string;
  title: string;
  group: string;
  columns: string[];
  number?: string;
  filters?: string[];
  images?: string[];
  description?: string;
  dataSections?: { title: string; fields: string[]; note: string }[];
};

export type OriginalSystemDef = {
  id: string;
  title: string;
  groups?: { number: string; title: string }[];
  pages: OriginalSystemPage[];
};

export type OriginalMaterial = {
  id: string;
  eventId: string;
  title: string;
  system: string;
  page: string;
  sourceId: string;
  sections: readonly (readonly [string, string])[];
  createdAt: string;
  receivedAt?: string;
};

const key = 'anneng-demo:v1:original-materials';
const targets: Record<string, [string, string]> = {
  KNOWLEDGE: ['business', 'K02'],
  SITUATION_REPORT: ['coordination', 'A01'],
  RESOURCE_REPORT: ['coordination', 'A01'],
  RESOURCE_QUERY: ['coordination', 'A01'],
  RESOURCE_STATUS: ['coordination', 'A01'],
  RESCUE_PLAN: ['coordination', 'S03'],
  RESCUE_EVAL: ['coordination', 'P02'],
  WITHDRAW_RETURN: ['coordination', 'W01'],
  WORK_SUMMARY: ['coordination', 'P02'],
  DUTY_DAILY: ['coordination', 'B03'],
  EMERGENCY_BRIEF: ['coordination', 'B03'],
  MEETING_MINUTES: ['coordination', 'P01'],
  现场智能勘察: ['coordination', 'S07'],
  规划梯队投送: ['coordination', 'F07'],
  预警推送: ['coordination', 'F02'],
  知识沉淀入库: ['business', 'K02'],
  编组确认: ['coordination', 'F03'],
  方案修订对比: ['coordination', 'S03'],
  回撤归建: ['coordination', 'W01'],
  资料核验与总结: ['coordination', 'P02'],
  资源维护与导出: ['business', 'W02'],
};

export function originalTarget(code: string): [string, string] {
  return targets[code] ?? ['coordination', 'E02'];
}

export function originalSystem(systemId: string): OriginalSystemDef | undefined {
  return (systems as OriginalSystemDef[]).find(s => s.id === systemId);
}

export function originalSystemTitle(systemId: string): string {
  return originalSystem(systemId)?.title ?? systemId;
}

export function originalPage(system: string, page: string): OriginalSystemPage | undefined {
  return originalSystem(system)?.pages.find(p => p.id === page);
}

/** 按钮/提示用：系统名 · 栏目名 */
export function originalDestinationLabel(system: string, page: string): string {
  const sys = originalSystemTitle(system);
  const pageTitle = originalPage(system, page)?.title;
  return pageTitle ? `${sys} · ${pageTitle}` : sys;
}

export function readOriginalMaterials(): OriginalMaterial[] {
  const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
  if (!Array.isArray(data)) throw new Error('原系统联动材料存储格式异常');
  return data.filter(
    (v): v is OriginalMaterial =>
      !!v &&
      typeof v.id === 'string' &&
      typeof v.eventId === 'string' &&
      typeof v.title === 'string' &&
      Array.isArray(v.sections) &&
      v.sections.every(
        (s: unknown) =>
          Array.isArray(s) && s.length === 2 && s.every(t => typeof t === 'string'),
      ) &&
      !!originalPage(v.system, v.page),
  );
}

export function stageOriginalMaterial(input: {
  code: string;
  eventId: string;
  title: string;
  sourceId: string;
  sections: OriginalMaterial['sections'];
}) {
  if (!input.eventId || input.eventId.startsWith('evt-blank-')) {
    throw new Error('请先关联灾情，再打开对应业务系统栏目');
  }
  const [system, page] = originalTarget(input.code);
  const records = readOriginalMaterials();
  const same = records.find(
    r =>
      r.sourceId === input.sourceId &&
      r.eventId === input.eventId &&
      r.system === system &&
      r.page === page &&
      JSON.stringify(r.sections) === JSON.stringify(input.sections),
  );
  const record =
    same ??
    ({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      title: input.title,
      sourceId: input.sourceId,
      system,
      page,
      sections: input.sections,
      createdAt: new Date().toISOString(),
    } satisfies OriginalMaterial);
  if (!same) localStorage.setItem(key, JSON.stringify([...records, record]));
  return `/originalSystems/${system}?${new URLSearchParams({
    page,
    event: input.eventId,
    report: record.id,
  })}`;
}

export function receiveOriginalMaterial(
  id: string,
  eventId: string,
  system: string,
  page: string,
) {
  const records = readOriginalMaterials();
  const found = records.find(
    r => r.id === id && r.eventId === eventId && r.system === system && r.page === page,
  );
  if (!found) throw new Error('材料不存在或不属于当前栏目与事件');
  localStorage.setItem(
    key,
    JSON.stringify(
      records.map(r =>
        r === found ? { ...r, receivedAt: r.receivedAt ?? new Date().toISOString() } : r,
      ),
    ),
  );
}
