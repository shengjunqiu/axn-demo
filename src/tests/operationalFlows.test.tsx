import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import OperationalFlows from '@/components/chat/OperationalFlows';

afterEach(cleanup);

describe('补充业务流程的确认边界', () => {
  it('勘察资料和专家意见未核实前禁止确认与导出', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-001"
        eventName="事件A"
        initial="现场智能勘察"
        eventStage="待研判"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('flow-multi-source')).toBeTruthy();
    expect(screen.getByTestId('multi-source-summary')).toBeTruthy();
    expect((screen.getByRole('button', { name: '回放视觉分析样例' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '载入灾前灾后演示资料' }));
    fireEvent.click(screen.getByRole('button', { name: '回放视觉分析样例' }));
    fireEvent.change(screen.getByLabelText('勘察专家意见'), { target: { value: '需补充现场检测' } });
    expect((screen.getByRole('button', { name: '确认专家复核' }) as HTMLButtonElement).disabled).toBe(true);
    screen.getAllByRole('checkbox', { name: '核实' }).forEach((el) => fireEvent.click(el));
    fireEvent.click(screen.getByRole('button', { name: '确认专家复核' }));
    expect(screen.getByText('复核意见已记录（模拟）')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('勘察专家意见'), { target: { value: '新增待核项' } });
    expect((screen.getByRole('button', { name: '导出勘察材料' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('知识入库要求提交审核和意见，修改材料撤销入库状态', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-001"
        eventName="事件A"
        initial="知识沉淀入库"
        eventStage="待复盘"
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '提炼当前事件案例草稿' }));
    expect((screen.getByRole('button', { name: '模拟审批通过并入库' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '提交入库审核' }));
    fireEvent.change(screen.getByLabelText('知识审核意见'), { target: { value: '限定内部可见' } });
    fireEvent.click(screen.getByRole('button', { name: '模拟审批通过并入库' }));
    expect(screen.getByText('模拟知识条目 V1 已入库，迭代任务已创建')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('复盘知识材料'), { target: { value: '修改后需要重新审批' } });
    expect(screen.queryByText('模拟知识条目 V1 已入库，迭代任务已创建')).toBeNull();
  });

  it('总结必须有逐项人工核验材料', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-002"
        eventName="事件B"
        initial="资料核验与总结"
        eventStage="待复盘"
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '载入演示过程资料' }));
    expect((screen.getByRole('button', { name: '生成所选总结初稿' }) as HTMLButtonElement).disabled).toBe(true);
    screen.getAllByRole('checkbox').forEach((el) => fireEvent.click(el));
    fireEvent.click(screen.getByRole('button', { name: '生成所选总结初稿' }));
    expect((screen.getByLabelText('总结初稿') as HTMLTextAreaElement).value).toContain('下一步改进计划');
  });

  it('救援中打开勘察：历史过程直接展示，无需载入演示资料', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-001"
        eventName="事件A"
        initial="现场智能勘察"
        eventStage="救援中"
        onClose={() => {}}
      />,
    );
    expect(screen.getAllByText(/历史过程/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '载入灾前灾后演示资料' })).toBeNull();
    expect(screen.getByText(/灾前现场资料/)).toBeTruthy();
    expect(screen.getByText('复核意见已记录（模拟回放）')).toBeTruthy();
  });

  it('按建设场景划分流程：力量投送中默认落力量投送，可见投送路径与编组', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-001"
        eventName="事件A"
        initial="规划梯队投送"
        eventStage="力量投送中"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('flow-scenario-rail')).toBeTruthy();
    expect(screen.getByTestId('flow-scenario-intro').textContent).toMatch(/力量投送/);
    expect(screen.getByTestId('flow-scenario-intro').textContent).toMatch(/救援资源管理/);
    expect(screen.getByText('投送路径优化')).toBeTruthy();
    expect(screen.getByText('编组确认')).toBeTruthy();
    expect(screen.queryByText('智能勘察分析')).toBeNull();
  });

  it('待研判打开复盘：未到达占位，不展示空操作表', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-001"
        eventName="事件A"
        initial="复盘评估分析"
        eventStage="待研判"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('尚未进入该阶段')).toBeTruthy();
    expect(screen.queryByText('载入演示过程资料')).toBeNull();
  });

  it('按建设场景划分流程：力量投送中默认落力量投送，可见投送路径与编组', () => {
    render(
      <OperationalFlows
        eventId="evt-demo-001"
        eventName="事件A"
        initial="规划梯队投送"
        eventStage="力量投送中"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('flow-scenario-rail')).toBeTruthy();
    expect(screen.getByTestId('flow-scenario-intro').textContent).toMatch(/力量投送/);
    expect(screen.getByTestId('flow-scenario-intro').textContent).toMatch(/救援资源管理/);
    expect(screen.getByText('投送路径优化')).toBeTruthy();
    expect(screen.getByText('编组确认')).toBeTruthy();
    expect(screen.queryByText('智能勘察分析')).toBeNull();
  });
});
