import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readOriginalMaterials, receiveOriginalMaterial, stageOriginalMaterial } from '@/services/originalSystem';
import OriginalSystemWorkspace from '@/components/workspace/OriginalSystemWorkspace';
beforeEach(()=>localStorage.removeItem('anneng-demo:v1:original-materials'));
afterEach(cleanup);
const input={code:'RESCUE_PLAN',eventId:'evt-demo-001',title:'现场方案A',sourceId:'doc-A',sections:[['基本情况','本次生成的正文A']] as [string,string][]};
describe('一期路由与关联材料',()=>{
  it('按栏目映射保存快照并支持刷新读取，重复点击不重复生成',()=>{
    const url=stageOriginalMaterial(input);expect(url).toContain('/originalSystems/coordination?');expect(url).toContain('page=S03');
    expect(stageOriginalMaterial(input)).toBe(url);expect(readOriginalMaterials()).toHaveLength(1);
    stageOriginalMaterial({...input,eventId:'evt-demo-002'});expect(readOriginalMaterials()).toHaveLength(2);
  });
  it('不允许错误事件或栏目接收材料，跳转不自动接收',()=>{
    stageOriginalMaterial(input);const record=readOriginalMaterials()[0];expect(record.receivedAt).toBeUndefined();
    expect(()=>receiveOriginalMaterial(record.id,'evt-demo-002','coordination','S03')).toThrow();
    expect(()=>receiveOriginalMaterial(record.id,input.eventId,'coordination','P02')).toThrow();
    receiveOriginalMaterial(record.id,input.eventId,'coordination','S03');expect(readOriginalMaterials()[0].receivedAt).toBeTruthy();
    expect(()=>stageOriginalMaterial({...input,eventId:'evt-blank-A'})).toThrow();
  });
  it('对应路由实际展示生成正文，事件错配不会展示',()=>{
    const url=stageOriginalMaterial(input);
    const view=render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/originalSystems/:system" element={<OriginalSystemWorkspace/>}/></Routes></MemoryRouter>);
    expect(screen.getByText('本次生成的正文A')).toBeTruthy();
    view.unmount();render(<MemoryRouter initialEntries={[url.replace('evt-demo-001','evt-demo-002')]}><Routes><Route path="/originalSystems/:system" element={<OriginalSystemWorkspace/>}/></Routes></MemoryRouter>);
    expect(screen.queryByText('本次生成的正文A')).toBeNull();expect(screen.getByText('关联材料不存在，或不属于此事件与栏目')).toBeTruthy();
  });
});
