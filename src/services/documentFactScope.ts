import type { DocumentDraft } from '@/domain/types';
import { type FactQueryScope } from './factLookup';

type DocumentScope = Pick<DocumentDraft, 'scopeKind' | 'eventId' | 'shiftId'>;

/** A document owns its lookup scope independently of the current workspace event. */
export function documentFactScope(document: DocumentScope | undefined): FactQueryScope | null {
  if (document?.scopeKind === 'event' && document.eventId) return { kind: 'event', eventId: document.eventId };
  if (document?.scopeKind === 'shift' && document.shiftId) return { kind: 'shift', shiftId: document.shiftId };
  return null;
}

export function resolveDocumentFact(factId: string, document: (DocumentScope & Partial<Pick<DocumentDraft, 'snapshot'>>) | undefined) {
  return document?.snapshot?.facts[factId] ?? null;
}
