"use client";
import { useState } from "react";
import { groupContent, type SavedGroup } from "@/lib/pilot/groups";
export function GroupEditor({
  email,
  shared = false,
  initial,
  seed,
  busy,
  onSave,
  onCancel,
}: {
  email: string;
  shared?: boolean;
  initial?: SavedGroup;
  seed?: SavedGroup["people"];
  busy: boolean;
  onSave: (group: Pick<SavedGroup, "name" | "people">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [step, setStep] = useState(0);
  const initialPeople = initial?.people ??
    seed ?? [
      { name: "You", email },
      { name: "", email: "" },
    ];
  const [people, setPeople] = useState([
    ...initialPeople.filter((p) => p.email === email),
    ...initialPeople.filter((p) => p.email !== email),
  ]);
  const [error, setError] = useState("");
  return (
    <form
      className={shared ? "sf-flow space-y-5" : "space-y-5 p-5"}
      onSubmit={(event) => {
        event.preventDefault();
        if (shared && step === 0) {
          setStep(1);
          return;
        }
        const result = groupContent.safeParse({
          name,
          people: people.map((p) => ({
            ...p,
            email: p.email.trim().toLowerCase(),
          })),
        });
        if (!result.success) {
          setError(
            result.error.issues[0]?.message ?? "Check the people and emails.",
          );
          return;
        }
        setError("");
        void onSave(result.data);
      }}
    >
      {(!shared || step === 0) && (
        <label className="block text-sm font-medium">
          Group name
          <input
            required
            autoFocus
            maxLength={80}
            disabled={busy}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-app-border p-3"
          />
        </label>
      )}
      {shared && step === 1 && (
        <h3 className="font-medium">Invite people to {name}</h3>
      )}
      {(!shared || step === 1) && (
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-3 text-sm font-semibold">People</legend>
          {people.map((person, index) => (
            <div
              key={index}
              className={
                shared
                  ? "grid gap-3 border-b pb-4 sm:grid-cols-[1fr_1.4fr_auto]"
                  : "grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1.4fr_auto]"
              }
            >
              <label className="text-sm">
                Name
                <input
                  required
                  aria-label={`Group person ${index + 1} name`}
                  maxLength={80}
                  value={person.name}
                  onChange={(event) =>
                    setPeople(
                      people.map((p, i) =>
                        i === index ? { ...p, name: event.target.value } : p,
                      ),
                    )
                  }
                  className="mt-1 block w-full min-w-0 rounded-lg border border-app-border p-3"
                />
              </label>
              <label className="text-sm">
                Email
                <input
                  required
                  type="email"
                  aria-label={`Group person ${index + 1} email`}
                  value={person.email}
                  readOnly={index === 0}
                  onChange={(event) =>
                    setPeople(
                      people.map((p, i) =>
                        i === index ? { ...p, email: event.target.value } : p,
                      ),
                    )
                  }
                  className="mt-1 block w-full min-w-0 rounded-lg border border-app-border p-3"
                />
              </label>
              {index !== 0 && people.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove group person ${index + 1}`}
                  onClick={() =>
                    setPeople(people.filter((_, i) => i !== index))
                  }
                  className="self-end px-3 py-3 text-sm underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={people.length >= 30}
            onClick={() => setPeople([...people, { name: "", email: "" }])}
            className="min-h-11 rounded-lg border border-app-border px-3 text-sm"
          >
            Add person
          </button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          className={
            shared
              ? "sf-primary"
              : "min-h-11 rounded-lg border-transparent bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700"
          }
        >
          {busy
            ? "Saving group…"
            : shared && step === 0
              ? "Continue to invitations"
              : "Save group"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={shared && step === 1 ? () => setStep(0) : onCancel}
          className="min-h-11 rounded-lg px-3 text-sm"
        >
          {shared && step === 1 ? "Back" : "Cancel edit"}
        </button>
      </div>
      <p className="text-xs leading-5 text-app-muted">
        {shared
          ? "Listed people receive an account-bound invitation. They must accept before joining a group activity. Each activity has its own participants."
          : "Only you can see this saved group. Using it prefills people; each published split still needs its own invitations."}
      </p>
    </form>
  );
}
