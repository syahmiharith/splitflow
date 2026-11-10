"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { Activity } from "@/lib/activity/model";
export function ActivityShare({ activity }: { activity: Activity }) {
  const [message, setMessage] = useState("");
  const link = `${location.origin}/?activity=${activity.id}`;
  return (
    <div className="space-y-5 text-sm">
      <p>
        Invite the people in this activity. They sign in with the email shown
        below.
      </p>
      <div className="sf-share-link-row">
      <label className="min-w-0 flex-1 font-medium">
        Activity link
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="mt-2 w-full rounded-lg border border-app-border p-3 font-normal"
        />
      </label>
      <button
        aria-label="Copy invitation link"
        type="button"
        onClick={() =>
          void navigator.clipboard
            .writeText(link)
            .then(() => setMessage("Link copied."))
            .catch(() => setMessage("Copy the link from the field above."))
        }
        className="sf-copy-link"
      >
        {message === "Link copied." ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        <span>{message === "Link copied." ? "Copied" : "Copy link"}</span>
      </button>
      </div>
      {message && <p role="status" className={message === "Link copied." ? "sf-action-feedback" : "text-app-muted"}>{message}</p>}
      <details>
        <summary className="min-h-11 cursor-pointer py-3">
          Who can open this? · {activity.people.length} people
        </summary>
        <ul className="divide-y">
          {activity.people.map((p) => (
            <li key={p.email} className="sf-share-person">
              <span className="sf-ledger-avatar" aria-hidden="true">{p.name.slice(0,1).toUpperCase()}</span>
              <span className="min-w-0"><strong className="font-medium">{p.name}</strong><small className="block break-all text-app-muted">{p.email}</small></span>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-xs text-app-muted">
        Only these accounts have access. Forwarding the link does not add
        members.
      </p>
    </div>
  );
}
