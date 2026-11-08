"use client";
import { useRef, useState } from "react";
import {
  activityInput,
  type Activity,
  type SharedGroup,
  type Person,
} from "@/lib/activity/model";
import { ExpenseForm } from "@/components/pilot-expense-form";
const inputClass =
  "mt-1 block w-full min-w-0 rounded-lg border border-app-border p-3";
export function NewActivityForm({
  email,
  group,
  groups,
  seed,
  busy,
  onSave,
}: {
  email: string;
  group?: SharedGroup;
  groups: SharedGroup[];
  seed?: Activity;
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [kind, setKind] = useState(
    seed?.kind ?? sessionStorage.getItem("splitflow-new-kind") ?? "quick",
  );
  const [groupId, setGroupId] = useState(group?.id ?? "");
  const chosen = groups.find((g) => g.id === groupId);
  const [people, setPeople] = useState<Person[]>(
    seed?.people ??
      group?.people.filter((p) => group.joined.includes(p.email)) ?? [
        { name: "You", email },
        { name: "", email: "" },
      ],
  );
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const result = activityInput.safeParse({
          title: data.get("title"),
          kind,
          people: people.map((p) => ({
            ...p,
            name: p.name.trim(),
            email: p.email.trim().toLowerCase(),
          })),
          ...(groupId ? { groupId } : {}),
          ...(seed ? { templates: seed.expenses.map((s) => s.expense) } : {}),
        });
        if (!result.success) {
          setError(
            result.error.issues[0]?.message ?? "Check the activity details.",
          );
          return;
        }
        setError("");
        void onSave(result.data).catch((e) => setError(e.message));
      }}
    >
      <label className="block">
        Activity name
        <input
          name="title"
          required
          autoFocus
          maxLength={120}
          defaultValue={seed ? `${seed.title} again` : ""}
          className={inputClass}
        />
      </label>
      <label className="block">
        Workflow
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={inputClass}
        >
          <option value="quick">Quick shared costs</option>
          <option value="planned">Planned activity</option>
          <option value="recurring">Recurring arrangement</option>
        </select>
      </label>
      <p className="text-xs text-app-muted">
        {kind === "recurring"
          ? "Set monthly terms in this conversation. Everyone reviews their share before automatic publication."
          : kind === "planned"
            ? "Agree on expected costs, then record what was actually spent."
            : "Record a cost that has already been paid and track repayments."}
      </p>
      <label className="block">
        Use a group (optional)
        <select
          value={groupId}
          disabled={Boolean(seed)}
          onChange={(e) => {
            setGroupId(e.target.value);
            const g = groups.find((g) => g.id === e.target.value);
            setPeople(
              g
                ? g.people.filter((p) => g.joined.includes(p.email))
                : [
                    { name: "You", email },
                    { name: "", email: "" },
                  ],
            );
          }}
          className={inputClass}
        >
          <option value="">No group</option>
          {groups
            .filter((g) => g.joined.includes(email))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </label>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-2 font-medium">People in this activity</legend>
        {chosen ? (
          <>
            {chosen.people.map((p) => (
              <label
                key={p.email}
                className="flex min-h-11 items-center gap-3 border-b py-2"
              >
                <input
                  type="checkbox"
                  checked={people.some((person) => person.email === p.email)}
                  disabled={
                    p.email === email || !chosen.joined.includes(p.email)
                  }
                  onChange={(e) =>
                    setPeople(
                      e.target.checked
                        ? [...people, p]
                        : people.filter((person) => person.email !== p.email),
                    )
                  }
                />
                <span className="min-w-0 break-words">
                  {p.name}
                  <span className="block text-xs text-app-muted">
                    {p.email}
                    {!chosen.joined.includes(p.email)
                      ? " · Invitation pending"
                      : ""}
                  </span>
                </span>
              </label>
            ))}
            <p className="text-xs text-app-muted">
              Invited people must join the group before they can be included.
              Existing activities keep their own participants.
            </p>
          </>
        ) : (
          <>
            {people.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 border-b pb-3">
                <label>
                  Name
                  <input
                    aria-label={`Activity person ${i + 1} name`}
                    required
                    maxLength={80}
                    value={p.name}
                    onChange={(e) =>
                      setPeople(
                        people.map((p, j) =>
                          j === i ? { ...p, name: e.target.value } : p,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label>
                  Email
                  <input
                    aria-label={`Activity person ${i + 1} email`}
                    type="email"
                    required
                    readOnly={p.email === email}
                    value={p.email}
                    onChange={(e) =>
                      setPeople(
                        people.map((p, j) =>
                          j === i ? { ...p, email: e.target.value } : p,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                {p.email !== email && (
                  <button
                    type="button"
                    onClick={() => setPeople(people.filter((_, j) => j !== i))}
                    className="min-h-11 text-left text-xs underline"
                    aria-label={`Remove activity person ${i + 1}`}
                  >
                    Remove person
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              disabled={people.length >= 30}
              onClick={() => setPeople([...people, { name: "", email: "" }])}
              className="min-h-11 px-2 underline"
            >
              Add person
            </button>
          </>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 rounded-lg bg-slate-900 px-4 text-white"
      >
        {busy ? "Starting activity…" : "Start activity"}
      </button>
    </form>
  );
}
export function ScheduleForm({
  activity,
  email,
  busy,
  onSave,
}: {
  activity: Activity;
  email: string;
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const expectedVersion = useRef(activity.schedule?.version ?? 0);
  const [source, setSource] = useState(
    activity.schedule ? "schedule" : (activity.expenses.at(-1)?.id ?? "new"),
  );
  const sourceExpense =
    source === "schedule"
      ? activity.schedule?.expense
      : activity.expenses.find((s) => s.id === source)?.expense;
  const [start, setStart] = useState(
      activity.schedule?.start ?? new Date().toISOString().slice(0, 10),
    ),
    [dueDay, setDueDay] = useState(activity.schedule?.dueDay ?? 1),
    [variable, setVariable] = useState(activity.schedule?.variable ?? false);
  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium">Monthly recurring cost</p>
      {activity.expenses.length > 0 && (
        <label className="block">
          Use an existing cost
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={inputClass}
          >
            {activity.schedule && (
              <option value="schedule">Current recurring terms</option>
            )}
            <option value="new">Enter a new cost</option>
            {activity.expenses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.expense.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        First period starts
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        Due day of month (1–28)
        <input
          type="number"
          min={1}
          max={28}
          value={dueDay}
          onChange={(e) => setDueDay(Number(e.target.value))}
          className={inputClass}
        />
      </label>
      <label className="block">
        <input
          type="checkbox"
          checked={variable}
          onChange={(e) => setVariable(e.target.checked)}
        />{" "}
        Variable bill: wait for each actual amount
      </label>
      <p>
        Everyone included must accept these terms before automatic publication.
        Changed terms require fresh acceptance.
      </p>
      <ExpenseForm
        key={source}
        reviewLabel="Review recurring terms"
        publishLabel="Share recurring terms"
        reviewHeading="Review monthly terms"
        allowAIDraft={false}
        email={email}
        busy={busy}
        initial={
          sourceExpense
            ? { ...structuredClone(sourceExpense), mode: "planned" }
            : {
                title: activity.title,
                mode: "planned",
                participants: activity.people.map((p) => ({ ...p, paid: 0 })),
                items: [
                  {
                    name: "Recurring cost",
                    amount: 0,
                    included: activity.people.map((p) => p.email),
                  },
                ],
              }
        }
        onSave={async (expense) =>
          onSave({
            type: "schedule",
            expectedVersion: expectedVersion.current,
            // Schedule templates store payer contributions using the existing paid schema.
            // Publication still creates planned obligations, never payment records.
            expense: { ...expense, mode: "paid" },
            start,
            dueDay,
            variable,
          })
        }
      />
    </div>
  );
}
