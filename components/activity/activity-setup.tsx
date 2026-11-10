"use client";
import { DatePicker } from "@/components/controls/date-picker";
import { Select } from "@/components/controls/select";
import { useEffect, useRef, useState } from "react";
import {
  activityInput,
  activityCommand,
  type Activity,
  type SharedGroup,
  type Person,
} from "@/lib/activity/model";
import {
  calculateExpense,
  expenseSchema,
  type Expense,
} from "@/lib/pilot/model";
import { money } from "./expense-card";
import { ExpenseForm } from "@/components/pilot-expense-form";
const inputClass =
  "mt-1 block w-full min-w-0 rounded-lg border border-app-border p-3";
export function NewActivityForm({
  email,
  group,
  groups,
  seed,
  suggestedTitle,
  repeat = true,
  onDraftChange,
  busy,
  onSave,
}: {
  email: string;
  group?: SharedGroup;
  groups: SharedGroup[];
  seed?: Activity;
  suggestedTitle?: string;
  repeat?: boolean;
  onDraftChange?: (draft: unknown) => void;
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
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(
    seed
      ? repeat
        ? `${seed.title} again`
        : seed.title
      : (suggestedTitle ?? ""),
  );
  const draftCallback = useRef(onDraftChange);
  draftCallback.current = onDraftChange;
  useEffect(() => {
    draftCallback.current?.({
      kind: "activity",
      title,
      activityKind: kind,
      groupId,
      people,
    });
  }, [title, kind, groupId, people]);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step) stepHeading.current?.focus();
  }, [step]);
  return (
    <form
      className="sf-flow space-y-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 0) {
          setStep(1);
          return;
        }
        const result = activityInput.safeParse({
          title,
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
      <p className="text-xs text-app-muted">
        {step === 0 ? "1 · Activity" : "2 · People"}
      </p>
      {step === 0 ? (
        <>
          <label className="block">
            Activity name
            <input
              name="title"
              required
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              What are you doing?
            </legend>
            <div className="sf-choice-list">
              {[
                { value: "quick", label: "Split a cost" },
                { value: "planned", label: "Plan together" },
                { value: "recurring", label: "Repeat monthly" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`sf-choice ${kind === option.value ? "sf-choice-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="workflow"
                    value={option.value}
                    checked={kind === option.value}
                    onChange={() => setKind(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-app-muted">
            {kind === "recurring"
              ? "Set monthly terms in this conversation. Everyone reviews their share before automatic publication."
              : kind === "planned"
                ? "Agree on expected costs, then record what was actually spent."
                : "Record a cost that has already been paid and track repayments."}
          </p>
        </>
      ) : (
        <>
          <h2
            ref={stepHeading}
            tabIndex={-1}
            className="text-lg font-medium outline-none"
          >
            Who’s sharing {title}?
          </h2>
          <label className="block">
            Use a group (optional)
            <Select
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
            </Select>
          </label>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-2 font-medium">
              People in this activity
            </legend>
            {chosen ? (
              <>
                {chosen.people.map((p) => (
                  <label
                    key={p.email}
                    className="flex min-h-11 items-center gap-3 border-b py-2"
                  >
                    <input
                      type="checkbox"
                      checked={people.some(
                        (person) => person.email === p.email,
                      )}
                      disabled={
                        p.email === email || !chosen.joined.includes(p.email)
                      }
                      onChange={(e) =>
                        setPeople(
                          e.target.checked
                            ? [...people, p]
                            : people.filter(
                                (person) => person.email !== p.email,
                              ),
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
                  Invited people must join the group before they can be
                  included. Existing activities keep their own participants.
                </p>
              </>
            ) : (
              <>
                {people.map((p, i) => (
                  <div
                    key={i}
                    className="grid gap-3 border-b pb-3 sm:grid-cols-2"
                  >
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
                        onClick={() =>
                          setPeople(people.filter((_, j) => j !== i))
                        }
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
                  onClick={() =>
                    setPeople([...people, { name: "", email: "" }])
                  }
                  className="min-h-11 px-2 underline"
                >
                  Add person
                </button>
              </>
            )}
          </fieldset>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between border-t pt-4">
        {step === 1 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep(0)}
            className="min-h-11 px-3"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          disabled={busy}
          className="min-h-11 rounded-lg bg-slate-900 px-5 text-white"
        >
          {busy
            ? "Starting activity…"
            : step === 0
              ? "Continue to people"
              : "Start activity"}
        </button>
      </div>
    </form>
  );
}

export function ScheduleForm({
  onDraftChange,
  seed,
  activity,
  email,
  busy,
  onSave,
}: {
  onDraftChange?: (draft: unknown) => void;
  seed?: { expense: Expense; start: string; dueDay: number; variable: boolean };
  activity: Activity;
  email: string;
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const expectedVersion = useRef(activity.schedule?.version ?? 0);
  const [options] = useState(() => [
    ...(seed
      ? [{ id: "assistant", label: "Assistant draft", expense: seed.expense }]
      : []),
    ...(activity.schedule
      ? [
          {
            id: "schedule",
            label: "Current recurring cost",
            expense: structuredClone(activity.schedule.expense),
          },
        ]
      : []),
    ...activity.expenses.map((s) => ({
      id: s.id,
      label: s.expense.title,
      expense: structuredClone(s.expense),
    })),
  ]);
  const [source, setSource] = useState(options[0]?.id ?? "new");
  const [expense, setExpense] = useState<Expense | undefined>(
    options[0]?.expense,
  );
  const [title, setTitle] = useState(activity.title);
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(email);
  const [step, setStep] = useState(0),
    [advanced, setAdvanced] = useState(false),
    [error, setError] = useState("");
  const [start, setStart] = useState(
    seed?.start ??
      activity.schedule?.start ??
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
  );
  const [dueDay, setDueDay] = useState(
      seed?.dueDay ?? activity.schedule?.dueDay ?? 1,
    ),
    [variable, setVariable] = useState(
      seed?.variable ?? activity.schedule?.variable ?? false,
    );
  const draftCallback = useRef(onDraftChange);
  draftCallback.current = onDraftChange;
  useEffect(() => {
    draftCallback.current?.({
      kind: "schedule",
      activityId: activity.id,
      expense,
      title,
      amount,
      payer,
      start,
      dueDay,
      variable,
    });
  }, [activity.id, expense, title, amount, payer, start, dueDay, variable]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step, advanced]);
  const primary =
    "min-h-11 rounded-lg bg-slate-900 px-5 text-white disabled:opacity-40";
  function blankCost(): Expense {
    return {
      title,
      mode: "paid",
      participants: activity.people.map((p) => ({
        ...p,
        paid: p.email === payer ? Number(amount) : 0,
      })),
      items: [
        {
          name: title || "Recurring cost",
          amount: Number(amount),
          included: activity.people.map((p) => p.email),
        },
      ],
    };
  }
  function command(value: Expense) {
    return {
      type: "schedule",
      expectedVersion: expectedVersion.current,
      expense: { ...value, mode: "paid" },
      start,
      dueDay,
      variable,
    };
  }
  function validateCost(value: Expense) {
    const parsed = expenseSchema.parse({ ...value, mode: "paid" });
    calculateExpense(parsed);
    return parsed;
  }
  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : "Check the cost and dates.");
  }
  const total = expense ? calculateExpense(expense) : undefined;
  return (
    <div className="sf-flow space-y-5 text-sm">
      <ol
        aria-label="Recurring setup progress"
        className="flex items-center gap-3 text-xs text-app-muted"
      >
        {["Cost", "Timing", "Review"].map((name, i) => (
          <li
            key={name}
            aria-current={step === i ? "step" : undefined}
            className={step === i ? "font-semibold text-app-text" : ""}
          >
            {i + 1} · {name}
          </li>
        ))}
      </ol>
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none"
      >
        {advanced
          ? "Adjust this cost"
          : step === 0
            ? "Which cost repeats?"
            : step === 1
              ? "When does it repeat?"
              : "Review monthly terms"}
      </h2>
      {step === 0 &&
        (advanced ? (
          <div>
            <ExpenseForm
              email={email}
              busy={busy}
              allowAIDraft={false}
              initial={{ ...(expense ?? blankCost()), mode: "planned" }}
              reviewLabel="Review cost details"
              publishLabel="Use these cost details"
              onSave={async (value) => {
                setExpense(validateCost(value));
                setSource("custom");
                setAdvanced(false);
              }}
            />
            <button
              type="button"
              onClick={() => setAdvanced(false)}
              className="min-h-11 underline"
            >
              Cancel cost changes
            </button>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                setExpense(
                  validateCost(source === "new" ? blankCost() : expense!),
                );
                setError("");
                setStep(1);
              } catch (err) {
                fail(err);
              }
            }}
          >
            {options.length > 0 && (
              <fieldset className="sf-choice-list divide-y">
                <legend className="sr-only">Choose a cost</legend>
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex min-h-16 cursor-pointer items-center gap-3 p-4"
                  >
                    <input
                      type="radio"
                      name="cost-source"
                      checked={source === option.id}
                      onChange={() => {
                        setSource(option.id);
                        setExpense(option.expense);
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {option.expense.title}
                      </span>
                      <span className="text-xs text-app-muted">
                        {option.id === "schedule"
                          ? "Current recurring cost · "
                          : ""}
                        {option.expense.participants.length} people
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {money(calculateExpense(option.expense).total, option.expense.currency)}
                    </span>
                  </label>
                ))}
                <label className="flex min-h-14 cursor-pointer items-center gap-3 p-4">
                  <input
                    type="radio"
                    name="cost-source"
                    checked={source === "new"}
                    onChange={() => {
                      setSource("new");
                      setExpense(undefined);
                    }}
                  />
                  Enter a new cost
                </label>
              </fieldset>
            )}
            {source === "new" ? (
              <div className="space-y-4">
                <label className="block">
                  Cost name
                  <input
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  Monthly amount (KRW)
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="1000000000"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full border-b border-app-border bg-transparent py-3 text-3xl font-semibold tabular-nums outline-none focus-visible:ring-2"
                  />
                </label>
                <label className="block">
                  Expected payer
                  <Select
                    value={payer}
                    onChange={(e) => setPayer(e.target.value)}
                    className={inputClass}
                  >
                    {activity.people.map((p) => (
                      <option key={p.email} value={p.email}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <p className="text-app-muted">
                  Split equally between {activity.people.length} people.
                </p>
              </div>
            ) : (
              source === "custom" &&
              expense && (
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {expense.title} · {expense.participants.length} people
                  </span>
                  <strong className="tabular-nums">
                    {money(total!.total, expense?.currency)}
                  </strong>
                </div>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setError("");
                setAdvanced(true);
              }}
              className="min-h-11 underline"
            >
              Edit cost or split rules
            </button>
            <div className="flex justify-end border-t pt-4">
              <button disabled={busy} className={primary}>
                Continue to timing
              </button>
            </div>
          </form>
        ))}
      {step === 1 && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const result = activityCommand.safeParse(command(expense!));
            if (!result.success) {
              setError(result.error.issues[0]?.message ?? "Check the dates.");
              return;
            }
            setError("");
            setStep(2);
          }}
        >
          <div className="flex justify-between border-b py-3">
            <span>Repeats</span>
            <strong>Monthly</strong>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              First period starts
              <DatePicker label="First period starts" value={start} onChange={setStart} className={inputClass} />
            </label>
            <label>
              Due day of month (1–28)
              <input
                type="number"
                min="1"
                max="28"
                required
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>
          <fieldset className="sf-choice-list divide-y">
            <legend className="mb-2 font-medium">How is the amount set?</legend>
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="radio"
                name="amount-type"
                checked={!variable}
                onChange={() => setVariable(false)}
              />
              <span>
                <strong className="block font-medium">
                  Same amount each month
                </strong>
                <span className="text-xs text-app-muted">
                  Publish the agreed cost automatically after everyone accepts.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="radio"
                name="amount-type"
                checked={variable}
                onChange={() => setVariable(true)}
              />
              <span>
                <strong className="block font-medium">
                  Amount changes each month
                </strong>
                <span className="text-xs text-app-muted">
                  Wait for the actual bill before recording each cost.
                </span>
              </span>
            </label>
          </fieldset>
          <div className="flex justify-between border-t pt-4">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="min-h-11 px-3"
            >
              Back to cost
            </button>
            <button disabled={busy} className={primary}>
              Review recurring terms
            </button>
          </div>
        </form>
      )}
      {step === 2 && expense && total && (
        <div className="space-y-5">
          <div>
            <p className="text-app-muted">{expense.title}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {money(total.total, expense?.currency)}
              <span className="ml-2 text-sm font-normal text-app-muted">
                / month{variable ? " · estimate" : ""}
              </span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-y py-4">
            <dt className="text-app-muted">First period</dt>
            <dd className="text-right">{start}</dd>
            <dt className="text-app-muted">Due each month</dt>
            <dd className="text-right">Day {dueDay}</dd>
            <dt className="text-app-muted">Publication</dt>
            <dd className="text-right">
              {variable ? "After actual bill" : "After everyone accepts"}
            </dd>
          </dl>
          <ul aria-label="Reviewed recurring shares" className="divide-y">
            {expense.participants.map((p) => (
              <li key={p.email} className="flex justify-between gap-4 py-3">
                <div>
                  <p>{p.name}</p>
                  {p.paid > 0 && (
                    <p className="mt-1 text-xs text-app-muted">
                      Expected to pay {money(p.paid, expense?.currency)}
                    </p>
                  )}
                </div>
                <span className="text-right font-medium tabular-nums">
                  {activity.schedule
                    ? `${money(calculateExpense(activity.schedule.expense).shares[p.email] ?? 0, activity.schedule.expense.currency)} → `
                    : ""}
                  {money(total.shares[p.email], expense?.currency)}
                </span>
              </li>
            ))}
          </ul>
          <details>
            <summary className="min-h-11 cursor-pointer py-3">
              Items and split rules
            </summary>
            {expense.items.map((item, i) => (
              <p key={i} className="py-2">
                {item.name} · {money(item.amount, expense?.currency)} ·{" "}
                {item.custom
                  ? "Custom amounts"
                  : item.units
                    ? "By units"
                    : "Equal shares"}
              </p>
            ))}
          </details>
          <p className="text-xs leading-5 text-app-muted">
            Sharing records your acceptance and asks everyone included to accept
            these terms.{" "}
            {activity.schedule ? "Previous acceptance is reset. " : ""}This does
            not send or confirm a payment.
          </p>
          <div className="flex justify-between border-t pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep(1)}
              className="min-h-11 px-3"
            >
              Back to timing
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError("");
                void onSave(command(expense)).catch(fail);
              }}
              className={primary}
            >
              {busy ? "Sharing…" : "Share recurring terms"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
