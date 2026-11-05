"use client";
import { useState } from "react";
import { pilotRequest } from "@/lib/pilot/session";
export function PilotFeedback({ splitId }: { splitId?: string }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="space-y-3">
      <button
        className="underline"
        onClick={() => {
          if (!open) setId(crypto.randomUUID());
          setOpen(!open);
        }}
      >
        Report a problem
      </button>
      {open && (
        <form
          className="space-y-3 rounded border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setMessage("");
            void pilotRequest("/api/pilot/feedback", {
              method: "POST",
              body: JSON.stringify({
                id,
                splitId,
                expected: data.get("expected"),
                actual: data.get("actual"),
              }),
            })
              .then(() => {
                setMessage("Report saved privately.");
                form.reset();
                setId(crypto.randomUUID());
              })
              .catch((error) => setMessage(error.message))
              .finally(() => setBusy(false));
          }}
        >
          <p>
            This report is visible to the pilot operator and your account.
            Include the steps needed to reproduce the problem.
          </p>
          <label className="block">
            What did you expect?
            <textarea
              className="block w-full border p-3"
              name="expected"
              required
              maxLength={1000}
            />
          </label>
          <label className="block">
            What happened?
            <textarea
              className="block w-full border p-3"
              name="actual"
              required
              maxLength={1000}
            />
          </label>
          <button
            disabled={busy}
            className="rounded bg-blue-600 p-3 text-white"
          >
            {busy ? "Saving report…" : "Save report privately"}
          </button>
          <p role="status">{message}</p>
        </form>
      )}
    </section>
  );
}
