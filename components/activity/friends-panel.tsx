"use client";
import { useState } from "react";
import type { SharedGroup } from "@/lib/activity/model";
import type { Operation } from "@/lib/activity/client";

export function FriendsPanel({ friends, email, busy, onSave }: {
  friends: SharedGroup[]; email: string; busy: boolean;
  onSave: (operation: Omit<Operation, "key">) => Promise<unknown>;
}) {
  const [error, setError] = useState("");
  async function save(operation: Omit<Operation, "key">) {
    setError("");
    try { await onSave(operation); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update friendship."); }
  }
  return <section aria-label="Friends" className="mb-6">
    <h3 className="font-semibold">Friends</h3>
    <p className="text-sm text-app-muted">Both people must add each other before sharing new costs. Friendship never confirms a debt.</p>
    {friends.map(friend => {
      const other = friend.people.find(p => p.email !== email)!;
      const added = friend.joined.includes(email), mutual = added && friend.joined.includes(other.email);
      return <div key={friend.id} className="sf-money-person">
        <div><strong>{other.name}</strong><small className="block text-app-muted">{other.email}</small><small>{mutual ? "Mutual friend" : added ? "Waiting for them to add you" : friend.joined.includes(other.email) ? "They added you" : "Not connected"}</small></div>
        <button disabled={busy} className="min-h-11 px-3" onClick={() => void save({kind:"group",id:friend.id,expected:friend.revision,command:{type:added ? "leave" : "join"}})}>{added ? "Remove friend" : "Add back"}</button>
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
