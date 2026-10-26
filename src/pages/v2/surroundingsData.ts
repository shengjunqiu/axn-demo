import { DISASTER_TEXT, EVENT_NAME } from './constants'

/** 页面与模拟报告共用同一份数据，不补写原页面缺失的队伍。 */
export const SURROUNDINGS_DATA = {
  eventName: EVENT_NAME,
  description: DISASTER_TEXT,
  radiusKm: 300,
  summary: '距事发地300公里范围内共有安能5支救援队伍，共171人、装备128台/套。',
  headers: ['所属工程局', '队伍名称', '队伍地址', '所属梯队', '队伍人数（人）', '队伍装备数（台/套）', '联系人', '联系电话', '距事发地距离（km）'],
  rows: [
    ['第二工程局', '南昌队常备中队', '江西省南昌市', '第一梯队', '54', '42', '郭洋', '—', '432.98'],
    ['第二工程局', '永新项目部', '江西省吉安市', '后备力量', '18', '12', '—', '—', '136.39'],
    ['第三工程局', '梅江灌区项目部', '江西省赣州市', '后备力量', '0', '0', '—', '—', '279.15'],
  ],
}

export const RESOURCE_REPORT_REQUEST = 'axn:v2-resource-report'
export const RESOURCE_REPORT_READY = 'axn:v2-resource-report-ready'
