/** 版本记录弹窗：按时间倒序，仅展示版本号与保存时间。 */
import { useState } from 'react';
import { Button, Checkbox, Modal } from 'antd';
import { GitCompareArrows } from 'lucide-react';
import type { DocVersion, VersionAuthor } from '@/store/mockDocumentStore';

export type VersionTarget = number | 'working';

export function authorText(author: VersionAuthor): string {
  if (author.kind === 'ai') return '安小能';
  if (author.kind === 'sample') return '文书库样稿';
  return author.role && author.role !== author.name ? `${author.name} · ${author.role}` : author.name;
}

export function versionTime(iso?: string, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? `今天 ${hm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

export default function DocVersionPanel({ versions, onClose }: {
  versions: DocVersion[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const toggleVersion = (no: number, checked: boolean) => {
    setSelected(current => checked
      ? current.includes(no) || current.length >= 2 ? current : [...current, no]
      : current.filter(value => value !== no));
  };

  return <Modal open className="doc-version-dialog" title="版本记录" centered width={440} footer={<div className="doc-version-dialog-footer">
    <span className="doc-version-selection-count">已选 <strong>{selected.length}</strong><span> / 2</span></span>
    <Button type="primary" icon={<GitCompareArrows size={16} aria-hidden />} disabled={selected.length !== 2}>版本对比</Button>
  </div>} onCancel={onClose}>
    <div className="doc-ver-modal" data-testid="doc-version-panel">
      <p className="doc-version-dialog-hint">选择两个版本进行对比</p>
      <ol className="doc-version-simple-list">
        {[...versions].reverse().map(version => <li key={version.no}>
          <Checkbox className="doc-version-simple-row" aria-label={`选择 V${version.no}`} checked={selected.includes(version.no)} disabled={selected.length >= 2 && !selected.includes(version.no)} onChange={event => toggleVersion(version.no, event.target.checked)}>
            <span className="doc-version-simple-content">
                <strong>V{version.no}</strong>
                <time dateTime={version.at}>{versionTime(version.at) || '—'}</time>
            </span>
          </Checkbox>
        </li>)}
      </ol>
    </div>
  </Modal>;
}
