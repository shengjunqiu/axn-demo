import { SourceList } from '@/components/common/ChatPrimitives';
import type { ReplySource } from '@/services/replySources';

export default function ReplySources({ sources }: { sources: ReplySource[] }) {
  return <details className="axn-reply-sources" data-testid="reply-sources">
    <summary>来源依据 <span>· {sources.length}</span></summary>
    <SourceList sources={sources} />
  </details>;
}
