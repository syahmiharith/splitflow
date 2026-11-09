"use client";
import { Search } from "lucide-react";
import { useState } from "react";
import type { SharedGroup } from "@/lib/activity/model";
import type { Operation } from "@/lib/activity/client";

export function FriendsPanel({ friends, email, busy, onSave }: {
  friends: SharedGroup[]; email: string; busy: boolean;
  onSave: (operation: Omit<Operation, "key">) => Promise<unknown>;
}) {
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const visible = friends.filter(friend => friend.people.some(person => person.email !== email && `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase())));
  async function save(operation: Omit<Operation, "key">) {
    setError("");
    try { await onSave(operation); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update friendship."); }
  }
  return <section aria-label="Friends" className="mb-6">
    <h3 className="font-semibold">Friends</h3>
    <p className="text-sm text-app-muted">Both people must add each other before sharing new costs. Friendship never confirms a debt.</p>
    {friends.length > 0 && <label className="sf-search-field mt-4"><Search size={17} aria-hidden="true" /><input aria-label="Search friends" placeholder="Search name or email" value={query} onChange={e => setQuery(e.target.value)} /></label>}
    {!friends.length && <p className="sf-search-empty">No friends added yet.</p>}
    {friends.length > 0 && !visible.length && <p className="sf-search-empty" role="status">No matching friends.</p>}
    {visible.map(friend => {
      const other = friend.people.find(p => p.email !== email)!;
      const added = friend.joined.includes(email), mutual = added && friend.joined.includes(other.email);
      return <div key={friend.id} className="sf-money-person">
        <span className="sf-ledger-avatar shrink-0" aria-hidden="true">{other.name.slice(0,1).toUpperCase()}</span>
        <div className="min-w-0 flex-1 break-words"><strong>{other.name}</strong><small className="block text-app-muted">{other.email}</small><small className="block text-app-muted">{mutual ? "Mutual friend" : added ? "Waiting for them to add you" : friend.joined.includes(other.email) ? "They added you" : "Not connected"}</small></div>
        <button disabled={busy} className={`sf-friend-action ${added ? "" : "sf-friend-add"}`} onClick={() => void save({kind:"group",id:friend.id,expected:friend.revision,command:{type:added ? "leave" : "join"}})}>{added ? "Remove friend" : "Add back"}</button>
      </div>;
    })}
    <details><summary className="min-h-11 cursor-pointer py-3">Add a friend manually</summary>
      <form className="grid gap-3" onSubmit={e => {
        e.preventDefault(); const data = new FormData(e.currentTarget);
        const otherEmail = String(data.get("email")).trim().toLowerCase();
        const existing = friends.find(f => f.people.some(p => p.email === otherEmail));
        void save(existing ? {kind:"group",id:existing.id,expected:existing.revision,command:{type:"join"}} : {kind:"group",id:crypto.randomUUID(),expected:0,input:{friendship:true,name:"Friendship",people:[{email,name:email},{email:otherEmail,name:String(data.get("name"))}]}});
      }}>
        <label>Name<input name="name" required maxLength={80} className="mt-1 block w-full rounded-lg border p-3" /></label>
        <label>Email<input name="email" type="email" required className="mt-1 block w-full rounded-lg border p-3" /></label>
        <button disabled={busy} className="min-h-11 rounded-lg bg-slate-900 px-3 text-white">Add friend</button>
      </form>
    </details>
    {error && <p role="alert">{error}</p>}
  </section>;
}
