import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EventsPage } from '@/pages/v2/pages/rosterPages';

afterEach(cleanup);
describe('V2事件列表处置响应', () => {
  it('进入对应事件详情并可返回列表', () => {
    render(<MemoryRouter initialEntries={['/v2/events']}><EventsPage /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: '处置响应' })[1]);
    const detail = screen.getByTestId('v2-event-detail');
    expect(within(detail).getByText(/当前事件：.*河北省石家庄市赞皇县电力火灾险情/)).toBeTruthy();
    expect(within(detail).getByText('电力应急险情')).toBeTruthy();
    expect(within(detail).getByRole('heading', { name: '处理过程' })).toBeTruthy();
    expect(within(detail).getByText('2026-10-09 16:35:36')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getAllByRole('button', { name: '处置响应' })).toHaveLength(8);
  });
  it('支持直接访问详情链接和编辑伤亡情况', async () => {
    render(<MemoryRouter initialEntries={['/v2/events?event=1']}><EventsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(await screen.findByRole('spinbutton', { name: '受伤人数' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
    expect(await screen.findByText('死亡0人、受伤3人、被困1人、失联0人。')).toBeTruthy();
  });
});
