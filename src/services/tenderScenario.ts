import type { DisasterProfile } from '@/seed/disasterScenarios';
/** 按实际记录的时间间隔计算演示趋势，不把采样点数当小时。 */
export function monitoringTrend(m: DisasterProfile['monitoring'][number], minutes: number) {
  const last=m.values.at(-1),previous=m.values.at(-2);
  const clock=(s:string)=>{const [h,n]=s.split(':').map(Number);return h*60+n;};
  const interval=m.times.length>1?clock(m.times.at(-1)!)-clock(m.times.at(-2)!):0;
  if(last==null||previous==null||!Number.isFinite(interval)||interval<=0||!Number.isFinite(last)||!Number.isFinite(previous))return {latest:last??null,delta:null,projection:null};
  const delta=Number((last-previous).toFixed(3));
  const progressMetric=/已联系|已转移|登记|获救|恢复用户|完成量|震级|深度|断电|人数|确认|完成率|进度/.test(m.label);
  return {latest:last,delta,projection:progressMetric?null:Number((last+delta*minutes/interval).toFixed(2))};
}
export function resourceComposition(profile:DisasterProfile, scale:number, blocked:boolean) {
  return profile.resources.map((r,i)=>{
    const amount=r.amount.match(/^(\d+(?:\.\d+)?)\s*([^\d/]+)$/);
    const available=amount?Number(amount[1]):null;
    const requested=available===null?null:Math.ceil(available*scale);
    return {...r,id:`${profile.eventId}-composition-${i}`,available,requested,unit:amount?.[2]??'原单位',gap:requested===null||available===null?null:Math.max(0,requested-available),route:blocked?'备用通道待核':'主通道待核'};
  });
}
