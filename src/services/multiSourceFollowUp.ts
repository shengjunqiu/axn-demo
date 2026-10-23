import type { DisasterSourceGroup, DisasterSourceKind } from '@/domain/multiSource';

const ACTIONS: Record<DisasterSourceKind, { title: string; question: string }> = {
  舆情: { title: '核实网上反映的情况', question: '请向属地或现场人员确认道路受影响、人员受困等消息是否属实，避免把转发消息当成现场事实。' },
  气象: { title: '确认现场天气', question: '请补充现场最新降雨及预警情况，确认资料时间和覆盖区域，判断是否影响出动与作业。' },
  水文: { title: '确认最新水情', question: '请核对最新水位、积水位置及监测时间，确认下游是否受影响，避免沿用过期读数。' },
  地质: { title: '确认地面和边坡是否安全', question: '请现场核查位移、裂缝等线索，补充专业人员意见，确认作业点及周边是否存在失稳风险。' },
  现场影像: { title: '补齐现场照片和原始材料', question: '请提供原始照片或视频，并注明拍摄位置、时间；政府微信群或传真材料还需确认来源及是否属于本次事件。' },
  接报记录: { title: '核对接报关键信息', question: '请与接报人确认事发位置、发生时间、受影响范围和人员情况，补充尚未明确的信息。' },
};

/** 按业务问题合并待核资料；原始引用保留在详情，避免把一份附件当成一项任务。 */
export function multiSourceFollowUp(sources: DisasterSourceGroup[]) {
  return sources.flatMap(source => {
    const count = source.records.filter(record => !record.duplicateOf && record.verification === '待核实').length;
    return count ? [{ kind: source.kind, count, ...ACTIONS[source.kind] }] : [];
  });
}
