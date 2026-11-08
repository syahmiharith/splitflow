"use client";
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
      <label className="block font-medium">
        Activity link
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="mt-2 w-full rounded-lg border border-app-border p-3 font-normal"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard
            .writeText(link)
            .then(() => setMessage("Link copied."))
            .catch(() => setMessage("Copy the link from the field above."))
        }
        className="min-h-11 rounded-lg bg-slate-900 px-4 text-white"
      >
        Copy invitation link
      </button>
      {message && <p role="status" className={message === "Link copied." ? "sf-action-feedback" : "text-app-muted"}>{message}</p>}
      <details>
        <summary className="min-h-11 cursor-pointer py-3">
          Who can open this? · {activity.people.length} people
        </summary>
        <ul className="divide-y">
          {activity.people.map((p) => (
            <li key={p.email} className="py-3">
              <p>{p.name}</p>
              <p className="break-all text-xs text-app-muted">{p.email}</p>
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
