"use client";
import { pilotRequest } from "@/lib/pilot/session";
import { useRef, useState } from "react";
import { calculateExpense, type Expense } from "@/lib/pilot/model";
export function ExpenseForm({
  email,
  original,
  busy,
  onSave,
}: {
  email: string;
  original?: Expense;
  busy: boolean;
  onSave: (expense: Expense, reason: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Expense>(
    original ?? {
      title: "",
      mode: "paid",
      participants: [
        { name: "You", email, paid: 0 },
        { name: "", email: "", paid: 0 },
      ],
      items: [{ name: "Dinner", amount: 0, included: [] }],
    },
  );
  const [description, setDescription] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [advanced, setAdvanced] = useState(Boolean(original));
  const submission = useRef<Expense | undefined>(undefined);
  function prepare() {
    try {
      const expense = advanced
        ? draft
        : {
            ...draft,
            participants: draft.participants.map((p, i) => ({
              ...p,
              paid: i === 0 ? draft.items[0].amount : 0,
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
      const normalized = {
        ...expense,
        participants: expense.participants.map((p) => ({
          ...p,
          email: p.email.trim().toLowerCase(),
        })),
      };
      calculateExpense(normalized);
      submission.current = normalized;
      setDraft(normalized);
      setReview(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your expense.");
    }
  }
  function updatePerson(
    index: number,
    field: "name" | "email" | "paid",
    value: string,
  ) {
    setDraft({
      ...draft,
      participants: draft.participants.map((p, i) =>
        i === index
          ? { ...p, [field]: field === "paid" ? Number(value) : value }
          : p,
      ),
    });
  }
  return (
    <form
      className="space-y-4 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (review && submission.current)
          void onSave(submission.current, reason);
        else prepare();
      }}
    >
      <h2 className="text-lg font-semibold">
        {review
          ? "Review before publishing"
          : original
            ? "Edit expense"
            : "New split"}
      </h2>
      <p role="alert">{error}</p>
      {!original && !review && (
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
        <p>Participants · First person pays by default</p>
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
