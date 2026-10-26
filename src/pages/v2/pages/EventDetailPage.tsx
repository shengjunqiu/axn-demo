import { useState } from 'react'
import { ArrowLeft, Clock3, Flag, Pencil, UserRound, UsersRound } from 'lucide-react'
import { Modal, InputNumber } from 'antd'
import './event-detail.css'

export function EventDetailPage({ event, onBack }: { event: readonly string[]; onBack: () => void }) {
  const electrical = event[1] === '电力应急险情'
  const [casualties, setCasualties] = useState([0, 1, 1, 0])
  const [draft, setDraft] = useState(casualties)
  const [editing, setEditing] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const labels = ['死亡', '受伤', '被困', '失联']
  const location = electrical ? '河北省石家庄市赞皇县黄北坪乡逸水山庄西北约821米' : event[0].replace(/灾情|险情/g, '')
  const counts = labels.map((label, index) => `${label}${casualties[index]}人`).join('、') + '。'
  return <div className="v2-event-detail" data-testid="v2-event-detail">
    <section className="v2-event-detail-main">
      <div className="v2-event-detail-bar">
        <button type="button" onClick={onBack}><ArrowLeft size={14} />返回</button>
        <Flag size={22} fill="#ff9b23" stroke="#ff9b23" />
        <strong>当前事件： {event[0]}</strong>
      </div>
      <div className="v2-event-detail-paper">
        <div className="v2-event-detail-owner"><span>中国安能/第一工程局</span><span>更新时间：{updatedAt || (electrical ? '2026-10-14 10:57:01' : event[3])}</span></div>
        <div className="v2-event-detail-facts">
          <img className="v2-event-detail-map" src="/v2-assets/event-detail-map.png" alt={electrical ? "河北省赞皇县逸水山庄附近道路与任务位置参考地图" : "地图样例，当前事件位置地图待接入"} />
          <p><label>任务时间：</label>{electrical ? '2026-10-09 16:35:36' : event[3]}</p>
          <p><label>任务地点：</label>{location}</p>
          <p><label>任务类型：</label>{event[1]}</p>
          <p><label>任务来源：</label>其他</p>
          <p><label>调用单位：</label>{event[2]}</p>
          <div className="v2-event-detail-attachment"><label>附件：</label><button type="button" onClick={() => setAttachmentOpen(true)} aria-label="查看任务附件"><span><img src="/v2-assets/word-attachment.png" alt="Word文档" /></span><small>遂行重庆彭…</small></button></div>
          <div className="v2-event-detail-casualties"><label>伤亡情况：</label>{labels.map((label, index) => <span key={label}>{label} <b className={`count-${index}`}>{casualties[index]}</b> 人</span>)}<button type="button" onClick={() => { setDraft([...casualties]); setEditing(true) }}><Pencil size={14} />编辑</button></div>
          <p className="v2-event-detail-description"><label>任务描述：</label>{electrical ? '工程局上报给集团抢险事件测试业务流程1009' : `${event[0]}，组织救援力量开展现场处置。`}</p>
        </div>
      </div>
    </section>
    <aside className="v2-event-process" aria-label="处理过程">
      <h2>处理过程<img src="/v2-assets/process-decoration.png" alt="" /></h2>
      <ol>
        <li><div className="process-record-heading"><span>更新伤亡情况</span><strong>中国安能</strong></div><p>{counts}</p><div><UsersRound size={14} />操作人: 管理员</div><div><Clock3 size={14} />{updatedAt || '2026-10-13 09:27:07'}</div></li>
        <li><div className="process-record-heading"><span>信息上报</span><strong>中国安能/第一工程局</strong></div><p>上报测试</p><div><UserRound size={14} />操作人: 二级审批</div><div><Clock3 size={14} />{electrical ? '2026-10-09 16:40:30' : event[3]}</div></li>
      </ol>
    </aside>
    <Modal title="编辑伤亡情况" open={editing} onCancel={() => setEditing(false)} onOk={() => { setCasualties(draft); setUpdatedAt(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })); setEditing(false) }} okText="保存" cancelText="取消">
      <div className="v2-event-casualty-form">{labels.map((label, index) => <label key={label}>{label}人数<InputNumber aria-label={`${label}人数`} min={0} precision={0} value={draft[index]} onChange={value => setDraft(current => current.map((n, i) => i === index ? value ?? 0 : n))} /></label>)}</div>
    </Modal>
    <Modal title="任务附件" open={attachmentOpen} onCancel={() => setAttachmentOpen(false)} footer={null}><p>遂行重庆彭水救援任务相关材料.docx</p><p>当前原型仅展示附件记录，未接入原系统文件下载服务。</p></Modal>
  </div>
}
