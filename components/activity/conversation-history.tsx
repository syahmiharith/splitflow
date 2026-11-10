"use client";
import { useState } from "react";
import { loadAssistantHistory } from "@/lib/assistant/client";
import type { Turn } from "@/lib/assistant/model";
import { ActionResult } from "./action-result";
export function ConversationHistory({ guest, email, id }: { guest: boolean; email: string; id: string }) {
 const [turns, setTurns] = useState<Turn[]>([]);
 const [before, setBefore] = useState<number | undefined>(undefined);
 const [more, setMore] = useState(true);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 async function load() {
  setBusy(true); setError("");
  try {
   const page = await loadAssistantHistory(guest, email, id, { before });
   setTurns(current => [...[...page.segments].sort((a,b) => a.index-b.index).flatMap(s => s.messages), ...current]);
   setMore(page.nextBefore !== null); setBefore(page.nextBefore ?? undefined);
  } catch (e) { setError(e instanceof Error ? e.message : "Unable to load earlier messages."); }
  finally { setBusy(false); }
 }
 return <section aria-label="Earlier messages">
  {more && <button className="min-h-11 text-sm underline" disabled={busy} onClick={() => void load()}>{busy ? "Loading earlier messages…" : "Load earlier messages"}</button>}
  {error && <p role="alert">{error}</p>}
  {turns.map(turn => <div key={turn.id} className={turn.role === "user" ? "sf-message-own" : "sf-assistant-reply"}>
   {turn.text && turn.text !== "Saved." && <p className="whitespace-pre-wrap">{turn.text}</p>}
   {turn.parts?.filter(p => p.type === "review").map((part, i) => part.type === "review" && <details key={i} className="sf-chat-card">
    <summary>{part.status === "saved" ? "Saved" : part.status === "discarded" ? "Discarded" : "Previous review"} · {part.proposal.previews[0]?.title}</summary>
    {part.proposal.previews.map((preview,j) => <ActionResult key={j} preview={preview} saved review />)}
   </details>)}
  </div>)}
 </section>;
}
