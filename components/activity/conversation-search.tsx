"use client";
import { useState } from "react";
import { Search, MessageCircle } from "lucide-react";
import type { Activity } from "@/lib/activity/model";
import type { ThreadSummary } from "@/lib/assistant/client";
import { ActivityDialog } from "./dialog";

/** Searches already-authorized titles; never fetches another member's private turns. */
export function ConversationSearch({ activities, threads, email, onActivity, onThread, onClose }: {
  activities: Activity[]; threads: ThreadSummary[]; email: string;
  onActivity: (id: string) => void; onThread: (thread: ThreadSummary) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const results = [
    ...activities.map(a => ({ id: a.id, title: a.title, detail: a.archivedBy.includes(email) ? "Archived activity" : "Activity", open: () => onActivity(a.id) })),
    ...threads.filter(t => !t.activityId).map(t => ({ id: t.id, title: t.title, detail: "Private conversation", open: () => onThread(t) })),
  ].filter(r => r.title.toLocaleLowerCase().includes(needle));
  return <ActivityDialog title="Search conversations" onClose={onClose}>
    <label className="sf-search-field">
      <Search size={17} aria-hidden="true" />
      <input autoFocus aria-label="Search conversation titles" placeholder="Search conversations" value={query} onChange={e => setQuery(e.target.value)} />
    </label>
    <div className="sf-search-results" aria-label="Conversation results">
      {results.map(result => <button type="button" key={result.id} className="sf-search-result" onClick={() => { result.open(); onClose(); }}>
        <MessageCircle size={17} aria-hidden="true" />
        <span><strong>{result.title}</strong><small>{result.detail}</small></span>
      </button>)}
      {!results.length && <p className="sf-search-empty" role="status">{needle ? `No conversations found for “${query.trim()}”.` : "Your conversations will appear here."}</p>}
    </div>
  </ActivityDialog>;
}
