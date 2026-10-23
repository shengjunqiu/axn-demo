import { isValidElement, type HTMLAttributes, type ReactNode } from 'react';
import type { TableProps } from 'antd';
import { KvTable, Notice, Section } from './ChatPrimitives';
import '@/components/chat/agent-results.css';

/** 业务流程分节：保留表单、确认按钮和定位标识，复用聊天标准控件的分节正文。 */
export function ResultSection({ title, extra, children, size: _size, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title?: ReactNode; extra?: ReactNode; size?: string }) {
  return <div {...props} className={`axn-agent-result ${props.className ?? ''}`}>
    {title ? <Section title={title}>{extra && <div className="axn-agent-result-actions">{extra}</div>}{children}</Section> : <>{extra}{children}</>}
  </div>;
}

/** 将结果表中的每条记录转为字段摘要，render 内的输入/核实/选择控件原样保留。 */
export function ResultRecords<T extends object>({ dataSource = [], columns = [], rowKey, style, className }: TableProps<T>) {
  const leaves = columns.flatMap(column => 'children' in column ? column.children : [column]);
  const node = (value: unknown): ReactNode => {
    if (value == null) return '—';
    if (isValidElement(value) || typeof value === 'string' || typeof value === 'number') return value;
    if (typeof value === 'object' && 'children' in value) return value.children as ReactNode;
    return String(value);
  };
  return <div className={`axn-agent-result axn-result-records ${className ?? ''}`} style={style}>
    {!dataSource.length && <Notice tone="info" title="暂无记录">请补充当前事件资料后继续。</Notice>}
    {dataSource.map((record, index) => {
      const key = typeof rowKey === 'function' ? rowKey(record, index) : rowKey ? (record as Record<string, unknown>)[String(rowKey)] : index;
      return <KvTable key={String(key ?? index)} rows={leaves.map((column, colIndex) => {
        const path = 'dataIndex' in column ? column.dataIndex : undefined;
        const value = path == null ? undefined : (Array.isArray(path) ? path : [path]).reduce<unknown>((result, field) => result == null ? undefined : (result as Record<string, unknown>)[String(field)], record);
        const rendered = 'render' in column && column.render ? column.render(value, record, index) : value;
        return { label: typeof column.title === 'function' ? `字段${colIndex + 1}` : column.title ?? `字段${colIndex + 1}`, value: node(rendered) };
      })} />;
    })}
  </div>;
}

/** 将流程反馈接入规范中的轻提示，原有 action 及确认回调保持可操作。 */
export function ResultNotice({ type = 'info', title, message, description, action, showIcon: _showIcon, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { type?: string; title?: ReactNode; message?: ReactNode; description?: ReactNode; action?: ReactNode; showIcon?: boolean }) {
  const tone = type === 'error' ? 'err' : type === 'warning' ? 'warn' : type === 'success' ? 'ok' : 'info';
  return <div {...props} className={`axn-agent-result ${props.className ?? ''}`}><Notice tone={tone} title={title ?? message}>{description}{action}</Notice></div>;
}
