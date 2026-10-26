import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResultRecords } from '@/components/common/AgentResultPrimitives';
import ResourceAuditReply from '@/components/chat/ResourceAuditReply';
import StructuredReply from '@/components/chat/StructuredReply';
import { resourceAuditSample } from '@/services/resourceAudit';

afterEach(cleanup);

describe('智能体结果控件保留业务交互和依据', () => {
  it('记录表换为字段摘要后，核实勾选和数量输入仍能修改对应记录', () => {
    function EditableRecords() {
      const [row, setRow] = useState({ id: 'one', verified: false, quantity: 0 });
      return <ResultRecords rowKey="id" dataSource={[row]} columns={[
        { title: '数量', render: (_, record) => <input aria-label="资源数量" type="number" value={record.quantity} onChange={e => setRow({ ...row, quantity: Number(e.target.value) })} /> },
        { title: '资料核实', render: (_, record) => <input aria-label="已核实资料" type="checkbox" checked={record.verified} onChange={e => setRow({ ...row, verified: e.target.checked })} /> },
      ]} />;
    }
    render(<EditableRecords />);
    fireEvent.change(screen.getByLabelText('资源数量'), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('已核实资料'));
    expect((screen.getByLabelText('资源数量') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('已核实资料') as HTMLInputElement).checked).toBe(true);
  });

  it('物资差异按类型筛选时仍可展开原始来源和数量，且不修改输入台账', () => {
    const rows = resourceAuditSample('异常样例');
    const original = JSON.stringify(rows);
    render(<ResourceAuditReply rows={rows} checkedAt="2026-10-15 10:00" />);
    fireEvent.click(screen.getByRole('button', { name: /^数量不一致$/ }));
    expect(screen.getAllByText(/数量不一致/).length).toBeGreaterThan(0);
    const details = screen.getAllByText(/查看对照记录/)[0];
    fireEvent.click(details);
    expect(screen.getAllByText('基地台账').length).toBeGreaterThan(0);
    expect(screen.getAllByText('集团汇总').length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).toBe(original);
  });

  it('多列文字结果转为字段摘要时，不丢失额外单元格或来源标识', () => {
    render(<StructuredReply text={'【核验结论】\n队伍 | 依据\n甲队 | source-001 | 尚待核实\n1. 补齐资料：确认台账版本'} />);
    for (const value of ['核验结论', '甲队', 'source-001', '尚待核实', '补齐资料', '确认台账版本']) expect(screen.getAllByText(value).length).toBeGreaterThan(0);
  });
  it('事件时间记录使用时间轴，保留节点详情和状态', () => {
    const view = render(<StructuredReply text={'序号 | 时间节点 | 环节 | 记录详情 | 状态\n1 | 08:30 | 信息接报 | 已收到现场报告 | 已完成\n2 | 09:00 | 现场核查 | 正在确认受影响范围 | 进行中'} />);
    expect(view.container.querySelector('.axn-event-timeline')).toBeTruthy();
    expect(screen.getByText('08:30')).toBeTruthy();
    expect(screen.getByText('正在确认受影响范围')).toBeTruthy();
    expect(screen.getByText('进行中')).toBeTruthy();
    expect(screen.queryByText('序号')).toBeNull();
  });

});
