"use client";
import { pilotRequest } from "@/lib/pilot/session";
import { useEffect, useRef, useState } from "react";
import {
  calculateExpense,
  expenseSchema,
  type Expense,
} from "@/lib/pilot/model";
export function ExpenseForm({
  email,
  original,
  initial,
  startInReview = false,
  onSaveDraft,
  busy,
  onSave,
  onDrafted,
  draftStorageKey,
  onDraftChange,
  allowAIDraft = true,
}: {
  email: string;
  allowAIDraft?: boolean;
  draftStorageKey?: string;
  onDraftChange?: (expense: Expense) => void;
  original?: Expense;
  initial?: Expense;
  startInReview?: boolean;
  onSaveDraft?: (expense: Expense) => Promise<void>;
  busy: boolean;
  onDrafted?: () => void;
  onSave: (expense: Expense, reason: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Expense>(() => {
    if (draftStorageKey) {
      try {
        const raw = localStorage.getItem(draftStorageKey);
        if (raw) return JSON.parse(raw);
      } catch {
        /* Recover from the supplied expense below. */
      }
    }
    return (
      initial ??
      original ?? {
        title: "",
        mode: "paid",
        participants: [
          { name: "You", email, paid: 0 },
          { name: "", email: "", paid: 0 },
        ],
        items: [{ name: "Dinner", amount: 0, included: [] }],
      }
    );
  });
  useEffect(() => {
    if (draftStorageKey)
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draft, draftStorageKey]);
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  const heading = useRef<HTMLHeadingElement>(null);
  const [payer, setPayer] = useState(
    Math.max(
      0,
      (initial ?? original)?.participants.findIndex((p) => p.paid > 0) ?? 0,
    ),
  );
  const [description, setDescription] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [review, setReview] = useState(startInReview);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [advanced, setAdvanced] = useState(
    Boolean(
      original ||
        (initial &&
          (initial.items.length > 1 ||
            initial.items.some(
              (item) =>
                item.custom ||
                item.units ||
                item.included.length !== initial.participants.length,
            ) ||
            initial.participants.filter((p) => p.paid > 0).length > 1)),
    ),
  );
  const submission = useRef<Expense | undefined>(
    startInReview ? initial : undefined,
  );
  useEffect(() => {
    heading.current?.focus();
  }, [review]);
  function prepare() {
    try {
      const expense = advanced
        ? draft
        : {
            ...draft,
            participants: draft.participants.map((p, i) => ({
              ...p,
              paid: i === payer ? draft.items[0].amount : 0,
            })),
            items: [
              {
                ...draft.items[0],
                included: draft.participants.map((p) =>
                  p.email.trim().toLowerCase(),
                ),
              },
            ],
          };
      const normalized = expenseSchema.parse({
        ...expense,
        participants: expense.participants.map((p) => ({
          ...p,
          email: p.email.trim().toLowerCase(),
        })),
      });
      calculateExpense(normalized);
      submission.current = normalized;
      setDraft(normalized);
      setReview(true);
      setError("");
      return normalized;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your expense.");
    }
  }
  function updatePerson(
    index: number,
    field: "name" | "email" | "paid",
    value: string,
  ) {
    const previousEmail = draft.participants[index].email;
    const nextValue =
      field === "paid"
        ? Number(value)
        : field === "email"
          ? value.trim().toLowerCase()
          : value;
    setDraft({
      ...draft,
      participants: draft.participants.map((person, personIndex) =>
        personIndex === index ? { ...person, [field]: nextValue } : person,
      ),
      items:
        field === "email"
          ? draft.items.map((item) => ({
              ...item,
              included: item.included.map((email) =>
                email === previousEmail ? String(nextValue) : email,
              ),
              custom: item.custom
                ? Object.fromEntries(
                    Object.entries(item.custom).map(([email, amount]) => [
                      email === previousEmail ? String(nextValue) : email,
                      amount,
                    ]),
                  )
                : undefined,
            }))
          : draft.items,
    });
  }

  if (review && submission.current) {
    const expense = submission.current;
    const calculation = calculateExpense(expense);
    return (
      <form
        className="space-y-5 rounded-lg border border-app-border bg-white p-5 md:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(expense, reason)
            .then(() => {
              if (draftStorageKey) localStorage.removeItem(draftStorageKey);
            })
            .catch((e) =>
              setError(e instanceof Error ? e.message : "Unable to publish."),
            );
        }}
      >
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-lg font-semibold focus:outline-none"
        >
          Review before publishing
        </h2>
        <div>
          <h3 className="text-base font-semibold">{expense.title}</h3>
          <p className="mt-1 text-sm text-app-muted">
            {expense.mode === "paid" ? "Already paid" : "Planned expense"} ·{" "}
            {expense.participants.length} people
          </p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            ₩{calculation.total.toLocaleString()}
          </p>
        </div>
        <ul className="divide-y divide-app-border" aria-label="Reviewed shares">
          {expense.participants.map((person) => (
            <li
              key={person.email}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span className="min-w-0 break-words">
                {person.name}
                <span className="mt-1 block text-app-muted">
                  {expense.mode === "planned"
                    ? "Expected contribution"
                    : "Paid"}{" "}
                  ₩{person.paid.toLocaleString()}
                </span>
              </span>
              <span className="shrink-0 text-right font-semibold tabular-nums">
                {original
                  ? `₩${calculateExpense(original).shares[person.email]?.toLocaleString() ?? "0"} → `
                  : ""}
                ₩{calculation.shares[person.email].toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
        <details>
          <summary className="min-h-11 cursor-pointer text-sm font-medium">
            Items and allocation rules
          </summary>
          <ul className="space-y-3 text-sm">
            {expense.items.map((item, index) => (
              <li key={index}>
                {item.name} · ₩{item.amount.toLocaleString()}
                <p className="text-app-muted">
                  {item.custom
                    ? "Custom shares"
                    : item.units
                      ? "By units"
                      : "Equal shares"}{" "}
                  ·{" "}
                  {item.included
                    .map(
                      (email) =>
                        expense.participants.find((p) => p.email === email)
                          ?.name,
                    )
                    .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </details>
        {original && (
          <label className="block text-sm">
            Reason for change
            <input
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 block w-full rounded border p-3"
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="rounded-lg bg-app-blue hover:bg-blue-700 border-transparent px-4 py-3 text-sm font-semibold text-white"
          >
            Publish split
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setReview(false)}
            className="rounded-lg border border-app-border px-4 py-3 text-sm"
          >
            Edit review
          </button>
          {onSaveDraft && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSaveDraft(expense)}
              className="px-3 py-3 text-sm"
            >
              Save draft
            </button>
          )}
        </div>
        <p className="text-xs text-app-muted">
          Publishing records the reviewed shares. Payments happen outside
          SplitFlow.
        </p>
      </form>
    );
  }
  return (
    <form
      className="space-y-5 rounded-lg border border-app-border bg-white p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (review && submission.current)
          void onSave(submission.current, reason);
        else prepare();
      }}
    >
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-lg font-semibold focus:outline-none"
      >
        {review
          ? "Review before publishing"
          : original
            ? "Edit expense"
            : "Expense details"}
      </h2>
      <p role="alert">{error}</p>
      {allowAIDraft && !original && !review && (
        <details>
          <summary>Describe expenses</summary>
          <label className="block">
            Expense description
            <textarea
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              className="block w-full border p-3"
            />
          </label>
          <p className="text-sm">
            Enter participant names and emails below first. Review all drafted
            amounts before publishing.
          </p>
          <button
            type="button"
            disabled={busy || drafting || !description.trim()}
            onClick={() => {
              setDrafting(true);
              setError("");
              void pilotRequest("/api/pilot/draft", {
                method: "POST",
                body: JSON.stringify({
                  message: description,
                  participants: draft.participants,
                }),
              })
                .then((expense) => {
                  setDraft(expense);
                  onDrafted?.();
                  setAdvanced(true);
                })
                .catch((error) => setError(error.message))
                .finally(() => setDrafting(false));
            }}
          >
            {drafting ? "Preparing draft…" : "Draft expenses"}
          </button>
        </details>
      )}
      <fieldset disabled={busy || review || drafting} className="space-y-4">
        <label className="block">
          Title
          <input
            required
            maxLength={120}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="block w-full rounded border p-3"
          />
        </label>
        <label className="block">
          Expense type
          <select
            className="block border p-3"
            value={draft.mode}
            onChange={(e) =>
              setDraft({ ...draft, mode: e.target.value as Expense["mode"] })
            }
          >
            <option value="paid">Already paid</option>
            <option value="planned">Plan an expense</option>
          </select>
        </label>
        <p>Participants</p>
        {draft.participants.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <label>
              Name
              <input
                required
                value={p.name}
                onChange={(e) => updatePerson(i, "name", e.target.value)}
                className="block w-full border p-3"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                disabled={Boolean(original)}
                value={p.email}
                onChange={(e) => updatePerson(i, "email", e.target.value)}
                className="block w-full border p-3"
              />
            </label>
            {advanced && (
              <label>
                Paid or committed (KRW)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={p.paid}
                  onChange={(e) => updatePerson(i, "paid", e.target.value)}
                  className="block w-full border p-3"
                />
              </label>
            )}
          </div>
        ))}
        {!original && (
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                participants: [
                  ...draft.participants,
                  { name: "", email: "", paid: 0 },
                ],
              })
            }
          >
            Add participant
          </button>
        )}
        {!advanced && (
          <label className="block">
            Total (KRW)
            <input
              required
              type="number"
              min="1"
              step="1"
              value={draft.items[0].amount || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  items: [
                    { ...draft.items[0], amount: Number(e.target.value) },
                  ],
                })
              }
              className="block w-full border p-3"
            />
          </label>
        )}
        {!advanced && (
          <label className="block">
            {draft.mode === "paid" ? "Who paid" : "Who will pay"}
            <select
              className="block w-full border p-3"
              value={payer}
              onChange={(event) => setPayer(Number(event.target.value))}
            >
              {draft.participants.map((person, index) => (
                <option key={index} value={index}>
                  {person.name || `Participant ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => {
              setAdvanced(e.target.checked);
              setDraft({
                ...draft,
                items: draft.items.map((item) => ({
                  ...item,
                  included: draft.participants.map((p) => p.email),
                })),
              });
            }}
          />{" "}
          Item exclusions, custom shares or multiple payers
        </label>
        {advanced &&
          draft.items.map((item, index) => (
            <div key={index} className="space-y-2 border p-3">
              <label>
                Item
                <input
                  required
                  value={item.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((v, i) =>
                        i === index ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                  className="block w-full border p-3"
                />
              </label>
              <label>
                Amount (KRW)
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={item.amount || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((v, i) =>
                        i === index
                          ? { ...v, amount: Number(e.target.value) }
                          : v,
                      ),
                    })
                  }
                  className="block w-full border p-3"
                />
              </label>
              {draft.participants.map((p) => (
                <label key={p.email} className="block">
                  <input
                    type="checkbox"
                    checked={item.included.includes(p.email)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                custom: undefined,
                                units: undefined,
                                included: e.target.checked
                                  ? [...v.included, p.email]
                                  : v.included.filter(
                                      (email) => email !== p.email,
                                    ),
                              }
                            : v,
                        ),
                      })
                    }
                  />{" "}
                  {p.name || "Participant"}
                </label>
              ))}
              <label className="block">
                <input
                  type="checkbox"
                  checked={Boolean(item.custom)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((v, i) =>
                        i === index
                          ? {
                              ...v,
                              units: undefined,
                              custom: e.target.checked
                                ? Object.fromEntries(
                                    v.included.map((email) => [email, 0]),
                                  )
                                : undefined,
                            }
                          : v,
                      ),
                    })
                  }
                />{" "}
                Set individual amounts
              </label>
              <label className="block">
                <input
                  type="checkbox"
                  checked={Boolean(item.units)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((v, i) =>
                        i === index
                          ? {
                              ...v,
                              custom: undefined,
                              units: e.target.checked
                                ? Object.fromEntries(
                                    v.included.map((email) => [email, 1]),
                                  )
                                : undefined,
                            }
                          : v,
                      ),
                    })
                  }
                />{" "}
                By units
              </label>
              {item.units &&
                item.included.map((email) => (
                  <label key={email} className="block">
                    {draft.participants.find((p) => p.email === email)?.name}{" "}
                    units
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                      value={item.units?.[email] ?? 1}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((v, i) =>
                            i === index
                              ? {
                                  ...v,
                                  units: {
                                    ...v.units,
                                    [email]: Number(e.target.value),
                                  },
                                }
                              : v,
                          ),
                        })
                      }
                      className="block w-full border p-3"
                    />
                  </label>
                ))}
              {item.custom &&
                item.included.map((email) => (
                  <label key={email} className="block">
                    {draft.participants.find((p) => p.email === email)?.name}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.custom?.[email] ?? 0}
                      className="block border p-3"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((v, i) =>
                            i === index
                              ? {
                                  ...v,
                                  custom: {
                                    ...v.custom,
                                    [email]: Number(e.target.value),
                                  },
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
            </div>
          ))}
        {advanced && (
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  {
                    name: "",
                    amount: 0,
                    included: draft.participants.map((p) => p.email),
                  },
                ],
              })
            }
          >
            Add item
          </button>
        )}
        {original && (
          <label className="block">
            Reason for change
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full border p-3"
            />
          </label>
        )}
      </fieldset>
      {review && (
        <>
          <ul>
            {draft.participants.map((p) => {
              const amount = calculateExpense(draft).shares[p.email];
              return (
                <li key={p.email}>
                  {p.name} ·{" "}
                  {original
                    ? `${calculateExpense(original).shares[p.email]} → `
                    : ""}
                  ₩{amount.toLocaleString()} · Paid ₩{p.paid.toLocaleString()}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setReview(false)}>
            Edit review
          </button>
        </>
      )}
      <button
        disabled={busy || drafting}
        className="rounded bg-blue-600 p-3 text-white"
      >
        {review ? "Publish split" : "Review split"}
      </button>
    </form>
  );
}
