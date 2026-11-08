import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Modal } from 'antd';
import { Check, MapPin, Search, X } from 'lucide-react';
import { factText, incidents } from '@/seed/scenario';
import ChatNotice from './ChatNotice';
import './composer-skill.css';

interface IncidentPickerProps {
  open: boolean;
  value: string;
  taskLabel?: string;
  hasUnsavedChanges?: boolean;
  /** 点选项即确认（输入框模板占位符替换用，不需要再点一次确认按钮）。 */
  confirmOnPick?: boolean;
  containerRef: { readonly current: HTMLDivElement | null };
  onClose: () => void;
  onSelect: (id: string) => void;
}

/** 居中的事件选择弹窗，保留搜索、任务续做及键盘选择。 */
export default function IncidentPicker({ open, value, taskLabel, hasUnsavedChanges = false, confirmOnPick = false, containerRef, onClose, onSelect }: IncidentPickerProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => incidents.map(incident => ({
    id: incident.eventId, title: factText(incident.factRefs.title), time: factText(incident.factRefs.occurredAt),
  })).sort((a, b) => b.time.localeCompare(a.time)), []);
  const keyword = query.trim().toLowerCase();
  const matches = rows.filter(row => !keyword || row.title.toLowerCase().includes(keyword));
  const options = matches;
  const bound = value !== 'none';
  const switching = bound && selectedId !== null && selectedId !== value;
  const selected = rows.find(row => row.id === selectedId);
  const current = rows.find(row => row.id === value);
  const confirm = () => { if (selected) { onSelect(selected.id); close(); } };
  const close = () => onClose();
  const pick = (id: string) => setSelectedId(id);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedId(rows.some(row => row.id === value) ? value : null);
    setActive(Math.max(0, rows.findIndex(row => row.id === value)));
    inputRef.current?.focus();
  }, [open, rows, value, taskLabel]);
  useEffect(() => {
    if (open) menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  const keyboard = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' && !((event.target as HTMLElement).matches('input, [role=option]'))) return;
    if (event.nativeEvent.isComposing || !['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') close();
    else if (event.key === 'Enter') { if (options[active]) { pick(options[active].id); requestAnimationFrame(() => confirmRef.current?.focus()); } }
    else if (options.length) setActive(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
  };
  return <Modal open={open} centered width={520} footer={null} closable={false} destroyOnHidden
    className="axn-incident-modal" title="选择关联灾情" classNames={{ header: 'axn-sr-only' }} onCancel={close} focusTriggerAfterClose={false}
    afterOpenChange={visible => { if (visible) inputRef.current?.focus(); }}
    afterClose={() => containerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()}>
    <div ref={menuRef} className="axn-incident-dialog" data-testid="incident-picker" onKeyDownCapture={keyboard} onMouseDown={event => event.stopPropagation()}>
      <div className="axn-composer-menu-heading"><span className="axn-incident-menu-title" title={taskLabel}>{taskLabel ? '选择要分析的事件' : <>关联事件 <span className="axn-composer-menu-count">{matches.length}</span></>}</span><button type="button" className="axn-composer-menu-close" aria-label="关闭事件选择" onClick={() => close()}><X size={14} /></button></div>
      {taskLabel && !bound && <div className="axn-composer-menu-query">确认绑定后将开始「{taskLabel}」。</div>}
      {bound && <div className="axn-composer-menu-query">当前会话已关联{current ? `「${current.title}」` : '原事件'}，更换事件将新开一个会话。</div>}
      <label className="axn-incident-search"><Search size={14} aria-hidden /><input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder="搜索事件名称" aria-label="搜索灾情" role="combobox" aria-expanded aria-controls="axn-incident-list" aria-activedescendant={options[active] ? `axn-incident-opt-${options[active].id}` : undefined} />{query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); setActive(0); inputRef.current?.focus(); }}><X size={14} /></button>}</label>
      <div className="axn-incident-list-heading"><span>{keyword ? `搜索结果 · ${matches.length}` : `全部事件 · ${rows.length}`}</span></div>
      <div className="axn-composer-menu-list" id="axn-incident-list" role="listbox" aria-label="灾情列表">
        {options.map((row, index) => <button type="button" key={row.id} id={`axn-incident-opt-${row.id}`} role="option" aria-selected={row.id === selectedId} data-active={index === active} className={`axn-composer-menu-option${index === active ? ' is-active' : ''}`} onFocus={() => setActive(index)} onPointerMove={() => setActive(index)} onClick={() => { pick(row.id); if (confirmOnPick) { onSelect(row.id); close(); } }}>
          <span className="axn-composer-menu-icon"><MapPin size={16} aria-hidden /></span><span className="axn-composer-menu-copy"><strong>{row.title}</strong></span>{row.id === selectedId && <Check size={16} className="axn-composer-menu-check" aria-hidden />}
        </button>)}
        {!options.length && <div className="axn-composer-menu-empty">没有找到「{query.trim()}」相关的灾情</div>}
      </div>
      <div className="axn-incident-confirm">
        {selected ? <div className="axn-incident-selected">已选择：<strong>{selected.title}</strong></div> : <div className="axn-incident-selected">请先选择一个灾情事件</div>}
        {switching && <ChatNotice tone="warn" title="更换事件将新开一个会话">原会话仍关联原事件，聊天记录和文件都会保留。{hasUnsavedChanges && '未保存的文书修改也会保留在原会话中。'}</ChatNotice>}
        <div className="axn-incident-confirm-actions"><Button aria-label="取消选择事件" onClick={close}>取消</Button><Button ref={confirmRef} type="primary" disabled={!selected} onClick={confirm}>{switching ? '新开会话并绑定' : bound ? '确认选择' : '确认绑定'}</Button></div>
      </div>
    </div>
  </Modal>;
}
