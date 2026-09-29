/**
 * 值班日报 · 红头样稿（空态展示）：Word 公文红头风格的 mock 排版预览。
 * 仅演示排版效果，非真实生成文书；数字与口径均来自演示种子（模拟数据）。
 */
import { Typography } from 'antd';

const { Text } = Typography;

export default function RedheadDailyMock() {
  return (
    <div className="axn-redhead-wrap">
      <div className="axn-redhead-meta">
        <Text strong style={{ fontSize: 13 }}>
          值班日报 · 红头样稿（模拟数据）
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          点击上方「生成值班日报」创建可编辑的正式稿（模拟）
        </Text>
      </div>
      <div className="axn-redhead-paper" data-testid="redhead-daily-mock">
        <div className="axn-redhead-org">安能市应急管理局</div>
        <div className="axn-redhead-title">应急值班日报</div>
        <div className="axn-redhead-no">应急值〔2025〕第 042 期（模拟）</div>
        <div className="axn-redhead-rule" />
        <div className="axn-redhead-meta-row">
          <span>值班单位：市应急指挥中心</span>
          <span>值班时段：今日 08:00—20:00</span>
        </div>
        <div className="axn-redhead-body">
          <p>
            <b>一、值班概况。</b>
            今日全市接报突发事件 2 起：演示区域 A 清河段堤防险情、演示区域 B 下穿道路积水预警，
            均已启动先期处置，人员伤亡情况待核实（模拟数据）。
          </p>
          <p>
            <b>二、处置进展。</b>
            清河段堤防险情：抢险队伍已到场开展反滤围井作业，现场转移安置工作有序进行；
            下穿道路积水：排水力量正在强排，相关路段已实施交通管制（模拟数据）。
          </p>
          <p>
            <b>三、下一步工作。</b>
            持续跟踪险情发展，统筹调度周边救援力量与物资，按时报送进展信息（模拟数据）。
          </p>
        </div>
        <div className="axn-redhead-foot">
          <span>报送：市委办公室、市政府办公室（模拟）</span>
          <span>值班电话：0533-8888（模拟）</span>
        </div>
      </div>
    </div>
  );
}
