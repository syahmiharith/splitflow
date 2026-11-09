import type { AssistantThread, Turn } from "./model";

export type HistorySegment = { index: number; messages: Turn[] };
export type HistoryOptions = { query?: string; before?: number; limit?: number };
export type HistoryPage = { segments: HistorySegment[]; nextBefore: number | null };

/** Same threshold as the transactional server save; never detach an active review. */
export function compactThread(thread: AssistantThread): { thread: AssistantThread; archived: Turn[] } {
  const next = structuredClone(thread);
  next.title ??= next.messages.find(m => m.role === "user")?.text.slice(0, 80);
  if (next.messages.length < 160 || next.pending) return { thread: next, archived: [] };
  let count = next.messages.length - 40;
  // Keep a review together with its saved result, avoiding a second card on reload.
  const retainedResults = new Set(next.messages.slice(count).flatMap(m => (m.parts ?? []).flatMap(p => p.type === "result" ? [p.proposalId] : [])));
  const linkedReview = next.messages.findIndex(m => m.parts?.some(p => p.type === "review" && retainedResults.has(p.proposal.id)));
  if (linkedReview >= 0) count = Math.min(count, linkedReview);
  if (count === 0) return { thread: next, archived: [] };
  const archived = next.messages.splice(0, count);
  next.historyCount = (next.historyCount ?? 0) + archived.length;
  return { thread: next, archived };
}

export function historyPage(segments: HistorySegment[], options: HistoryOptions = {}): HistoryPage {
  const query = options.query?.trim().toLowerCase();
  const matching = segments.filter(s => options.before === undefined || s.index < options.before)
    .map(s => ({ ...s, messages: query ? s.messages.filter(m => m.text.toLowerCase().includes(query)) : s.messages }))
    .filter(s => s.messages.length).sort((a, b) => b.index - a.index);
  const page = matching.slice(0, Math.min(5, Math.max(1, options.limit ?? 1)));
  return { segments: page, nextBefore: matching.length > page.length ? page.at(-1)!.index : null };
}
