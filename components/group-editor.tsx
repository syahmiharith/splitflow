"use client";
import { useState } from "react";
import { groupContent, type SavedGroup } from "@/lib/pilot/groups";
export function GroupEditor({
  email,
  initial,
  seed,
  busy,
  onSave,
  onCancel,
}: {
  email: string;
  initial?: SavedGroup;
  seed?: SavedGroup["people"];
  busy: boolean;
  onSave: (group: Pick<SavedGroup, "name" | "people">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
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
      className="space-y-5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
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
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">People</legend>
        {people.map((person, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1.4fr_auto]"
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
                onClick={() => setPeople(people.filter((_, i) => i !== index))}
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
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          className="min-h-11 rounded-lg border-transparent bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {busy ? "Saving group…" : "Save group"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="min-h-11 rounded-lg px-3 text-sm"
        >
          Cancel edit
        </button>
      </div>
      <p className="text-xs leading-5 text-app-muted">
        Only you can see this saved group. Using it prefills people; each
        published split still needs its own invitations.
      </p>
    </form>
  );
}
