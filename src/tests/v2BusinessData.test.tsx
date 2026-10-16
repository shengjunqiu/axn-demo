import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApprovalPage, BriefsPage, SummaryPage, SuppliesPage } from '@/pages/v2/pages/rosterPages';
import { TasksPage } from '@/pages/v2/pages/fieldPages';
import { SUPPLY_ITEMS, supplyGap, supplyExpected, SUPPLY_GAPS, SUPPLY_AUDIT_TEXT, TASK_RECORDS } from '@/pages/v2/businessData';
import { planReportSections } from '@/services/embeddedResourceReport';
import { summaryAiSections, transportAiSections } from '@/pages/v2/additionalAiData';
import qa from '@/pages/v2/embeddedQa.json';

afterEach(cleanup);
describe('V2业务演示资料', () => {
  it.each([ApprovalPage, BriefsPage, SummaryPage, TasksPage])('%s默认展示多条业务记录', Component => {
    render(<Component />);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(3);
    expect(screen.queryByText('暂无数据')).toBeNull();
    expect(screen.queryByText('无数据')).toBeNull();
  });
  it('四个物资页签切换真实口径，查询也不改变全量台账', () => {
    render(<SuppliesPage />);
    const tabs = screen.getAllByRole('tab');
    for (let i = 0; i < tabs.length; i++) {
      fireEvent.click(tabs[i]);
      expect(screen.getAllByRole('row')).toHaveLength(SUPPLY_ITEMS.length + 1);
    }
    expect(screen.getByRole('columnheader', { name: '账实差异' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: /^-5$/ })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('请输入物资名称'), { target: { value: '饮用水' } });
    fireEvent.click(screen.getByRole('button', { name: /^查询$/ }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(SUPPLY_ITEMS).toHaveLength(5);
  });
  it('各任务分组有记录，筛选可恢复全部', () => {
    render(<TasksPage />);
    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    }
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(screen.getAllByRole('row')).toHaveLength(TASK_RECORDS.length + 1);
  });
  it('核验、问答与生成方案一致引用缺口，库存不重复扣减消耗', () => {
    expect(SUPPLY_GAPS).toBe('饮用水25箱、雨衣10件、急救包8套');
    expect(SUPPLY_ITEMS.filter(item => supplyExpected(item) !== item.stock)).toHaveLength(1);
    expect(supplyExpected(SUPPLY_ITEMS[0])).toBe(50);
    expect(supplyGap(SUPPLY_ITEMS[0])).toBe(25);
    expect(SUPPLY_ITEMS[0].stock - supplyExpected(SUPPLY_ITEMS[0])).toBe(-5);
    expect(SUPPLY_AUDIT_TEXT).toContain(SUPPLY_GAPS);
    const qaText = JSON.stringify(qa);
    expect(qaText).not.toContain('当前页面没有物资明细');
    for (const item of SUPPLY_ITEMS.filter(item => supplyGap(item) > 0)) {
      expect(qa.supplies.items[0].answer).toContain(`${item.name}${supplyGap(item)}${item.unit}`);
    }
    for (const sections of [planReportSections(), summaryAiSections(), transportAiSections()]) {
      const body = sections.map(section => section[1]).join('\n');
      expect(body).toContain(SUPPLY_GAPS);
      expect(body).toContain('差异-5箱');
      expect(body).not.toContain('暂无已编制报告');
    }
  });
});
