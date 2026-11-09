"use client";
import { formatMoney, parseMoney, currencyMinorUnits } from "@/lib/finance/money";
import { Select } from "@/components/controls/select";
import { useState, useEffect } from "react";
import {
  balances,
  claimState,
  agreedExpense,
  calculateExpense,
  itemShare,
  settlements,
  type Split,
  type commandSchema,
} from "@/lib/pilot/model";
import type { z } from "zod";
import { nextAction } from "@/lib/pilot/next-action";
export const money = (value: number, currency = "KRW") => formatMoney(value, currency);
export function ExpenseCard({
  draftCommand,
  split,
  email,
  busy,
  onCommand,
  onEdit,
}: {
  draftCommand?: Record<string, unknown>;
  split: Split & { period?: string; dueDate?: string };
  email: string;
  busy: boolean;
  onCommand: (command: z.infer<typeof commandSchema>) => Promise<void>;
  onEdit: () => void;
}) {
  const money = (value: number) => formatMoney(value, split.expense.currency ?? "KRW");
  const [action, setAction] = useState<"correction" | "payment" | null>(null);
  useEffect(() => {
    if (draftCommand?.type === "report") setAction("payment");
    else if (
      draftCommand?.type === "respond" &&
      draftCommand.status === "correction"
    )
      setAction("correction");
  }, [draftCommand]);
  const [reviewed, setReviewed] = useState(split.revision);
  const stale = reviewed !== split.revision;
  async function act(command: z.infer<typeof commandSchema>) {
    if (stale) throw Error("Review the updated expense first.");
    await onCommand(command);
    setReviewed(split.revision + 1);
  }
  const included = split.expense.participants.some((p) => p.email === email),
    calculated = calculateExpense(split.expense),
    remaining = balances(split),
    state = claimState(split);
  const agreement = agreedExpense(split);
  const targets = settlements(split).filter((p) => p.from === email);
  return (
    <article
      id={`expense-${split.id}`}
      tabIndex={-1}
      aria-label={`${split.expense.title} expense`}
      className="sf-response sf-expense-row"
    >
      <div className="flex justify-between gap-4">
        {split.audit[0]?.at && (
          <time className="sf-expense-date" dateTime={split.audit[0].at}>
            {new Date(split.audit[0].at).toLocaleDateString("en-GB", {
              month: "short",
              day: "numeric",
              timeZone: "Asia/Seoul",
            })}
          </time>
        )}
        <div>
          <h3 className="font-semibold">{split.expense.title}</h3>
          <p className="mt-1 text-xs text-app-muted">
            {split.expense.participants
              .filter((p) => p.paid > 0)
              .map(
                (p) =>
                  `${p.name} ${split.expense.mode === "planned" ? "expects to pay" : "reported paying"} ${money(p.paid)}`,
              )
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-app-muted">
            {split.expense.mode === "planned" ? "Planned" : "Recorded"} ·{" "}
            {money(calculated.total)}
            {split.dueDate ? ` · Due ${split.dueDate}` : ""}
          </p>
        </div>
        {included && (
          <div className="text-right">
            <p className="text-xs text-app-muted">{state === "agreed" ? "Agreed share" : "Claimed share"}</p>
            <strong>{money(calculated.shares[email])}</strong>
          </div>
        )}
      </div>
      {state !== "agreed" && <p className="mt-3 text-sm">{state === "disputed" ? "Disputed claim — neither statement establishes what happened." : "Awaiting agreement — this claim is not an agreed debt."}</p>}
      {state !== "agreed" && agreement && <p className="mt-2 text-sm text-app-muted">Previously agreed share: {money(calculateExpense(agreement).shares[email] ?? 0)}. Confirmed payments remain recorded.</p>}
      {included && split.expense.mode === "paid" && (
        <p
          className={`mt-3 font-medium ${remaining[email] > 0 ? "sf-owe" : remaining[email] < 0 ? "sf-owed" : ""}`}
        >
          {remaining[email] > 0
            ? `You owe ${money(remaining[email])}`
            : remaining[email] < 0
              ? `You’re owed ${money(-remaining[email])}`
              : state === "agreed" ? "Settled" : "No agreed amount outstanding"}
        </p>
      )}
      {targets.length > 0 && split.expense.mode === "paid" && (
        <p className="mt-1 text-sm">
          {targets
            .map(
              (t) =>
                `Repay ${split.expense.participants.find((p) => p.email === t.to)?.name}: ${money(t.amount)}`,
            )
            .join(" · ")}
        </p>
      )}
      {included && (
        <p className="mt-2 text-sm text-app-muted">
          {nextAction(split, email)}
        </p>
      )}
      {stale && (
        <div role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
          <p>
            This expense changed. Check the current shares before responding.
          </p>
          <button
            onClick={() => setReviewed(split.revision)}
            className="min-h-11 underline"
          >
            I reviewed the updated expense
          </button>
        </div>
      )}
      <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-3">
          Why this amount?
        </summary>
        {split.expense.items.map((item, i) => (
          <p key={i} className="py-1">
            {item.name}: {money(itemShare(item, email))}
            {!item.included.includes(email)
              ? " · Excluded"
              : item.units
                ? ` · ${item.units[email]} units`
                : ""}
          </p>
        ))}
        <div className="mt-3 border-t pt-3">
          {split.expense.participants.map((p) => (
            <p key={p.email} className="flex justify-between gap-3 py-1">
              <span>
                {p.name}
                {p.paid
                  ? ` · ${split.expense.mode === "planned" ? "expects to pay" : "reported paying"} ${money(p.paid)}`
                  : ""}
              </span>
              <span>{money(calculated.shares[p.email])}</span>
            </p>
          ))}
        </div>
      </details>
      <div className="flex flex-wrap gap-2 text-sm">
        {split.organizer === email && (
          <button
            disabled={busy || stale}
            onClick={onEdit}
            className="min-h-11 rounded-lg bg-slate-100 px-3"
          >
            {split.expense.mode === "planned"
              ? "Record actual cost / edit"
              : "Edit expense"}
          </button>
        )}
        {included &&
          split.responses[email]?.status !== "accepted" && (
            <>
              <button
                disabled={busy || stale}
                onClick={() =>
                  void act({
                    type: "respond",
                    status: "accepted",
                    reason: "",
                  }).catch(() => {})
                }
                className="min-h-11 rounded-lg bg-slate-900 px-3 text-white"
              >
                Accept share
              </button>
              <button
                disabled={busy || stale}
                onClick={() =>
                  void act({
                    type: "respond",
                    status: "declined",
                    reason: "I do not agree with this claim.",
                  }).catch(() => {})
                }
                className="min-h-11 px-3"
              >
                Dispute claim
              </button>
            </>
          )}
        {included && (
          <button
            disabled={busy || stale}
            onClick={() =>
              setAction(action === "correction" ? null : "correction")
            }
            className="min-h-11 px-3"
          >
            Request correction
          </button>
        )}
        {included &&
          split.expense.mode === "paid" &&
          (remaining[email] ?? 0) > 0 && (
            <button
              disabled={busy || stale}
              onClick={() => setAction(action === "payment" ? null : "payment")}
              className="min-h-11 rounded-lg bg-slate-900 px-3 text-white"
            >
              Report payment
            </button>
          )}
      </div>
      {action === "correction" && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void act({
              type: "respond",
              status: "correction",
              reason: String(form.get("reason")),
            })
              .then(() => setAction(null))
              .catch(() => {});
          }}
        >
          <label className="block text-sm">
            What needs correcting?
            <textarea
              name="reason"
              defaultValue={
                typeof draftCommand?.reason === "string"
                  ? draftCommand.reason
                  : ""
              }
              required
              maxLength={500}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>
          <button
            disabled={busy || stale}
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-white"
          >
            Send correction request
          </button>
        </form>
      )}
      {action === "payment" && (
        <form
          className="mt-3 grid gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void act({
              type: "report",
              to: String(data.get("to")),
              amount: parseMoney(String(data.get("amount")), split.expense.currency ?? "KRW"),
              reference: String(data.get("reference")),
            })
              .then(() => setAction(null))
              .catch(() => {});
          }}
        >
          <label>
            Recipient
            <Select
              name="to"
              defaultValue={
                typeof draftCommand?.to === "string"
                  ? draftCommand.to
                  : targets[0]?.to
              }
              onChange={(e) => {
                const input = e.currentTarget.form?.elements.namedItem(
                  "amount",
                ) as HTMLInputElement | null;
                const target = targets.find((t) => t.to === e.target.value);
                if (input) input.value = String(target?.amount ?? "");
              }}
              className="mt-1 block w-full rounded-lg border p-3"
            >
              {split.expense.participants
                .filter((p) => p.email !== email)
                .map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Amount ({split.expense.currency ?? "KRW"})
            <input
              name="amount"
              type="number"
              min={1 / 10 ** currencyMinorUnits(split.expense.currency ?? "KRW")}
              step={1 / 10 ** currencyMinorUnits(split.expense.currency ?? "KRW")}
              required
              defaultValue={
                (typeof draftCommand?.amount === "number"
                  ? draftCommand.amount
                  : (targets[0]?.amount ?? remaining[email])) / 10 ** currencyMinorUnits(split.expense.currency ?? "KRW")
              }
              className="mt-1 block w-full rounded-lg border p-3"
            />
          </label>
          <label>
            Reference (optional)
            <input
              name="reference"
              defaultValue={
                typeof draftCommand?.reference === "string"
                  ? draftCommand.reference
                  : ""
              }
              maxLength={200}
              className="mt-1 block w-full rounded-lg border p-3"
            />
          </label>
          <button
            disabled={busy || stale}
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-white"
          >
            Report sent
          </button>
        </form>
      )}
      {Object.entries(split.responses)
        .filter(([, r]) => r.status === "correction" || r.status === "declined")
        .map(([person, r]) => (
          <p key={person} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
            {split.expense.participants.find((p) => p.email === person)?.name}:{" "}
            {r.reason || "Declined participation"}
          </p>
        ))}
      {Boolean(split.responseHistory?.length) && <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-3">Agreement and dispute history</summary>
        {split.responseHistory?.map((response, i) => <p key={i} className="py-1">
          {split.expense.participants.find(p => p.email === response.actor)?.name ?? response.actor}: {response.status} · revision {response.revision}{response.reason ? ` · ${response.reason}` : ""}{response.at ? ` · ${new Date(response.at).toLocaleDateString("en-GB", {timeZone:"Asia/Seoul"})}` : ""}
        </p>)}
        {split.agreement && <p>Last agreed version: {split.agreement.revision}. A later dispute does not erase that agreement or confirmed transfers.</p>}
      </details>}
      {split.repayments.length > 0 && (
        <h4 className="mt-5 text-sm font-medium">Repayments</h4>
      )}
      {split.repayments.map((p) => (
        <div key={p.id} className="mt-3 border-t pt-3 text-sm">
          <p>
            {split.expense.participants.find((m) => m.email === p.from)?.name} →{" "}
            {split.expense.participants.find((m) => m.email === p.to)?.name}:{" "}
            {money(p.amount)} · {p.status}
          </p>
          {p.reference && <p className="text-app-muted">{p.reference}</p>}
          {p.to === email && p.status !== "confirmed" && (
            <div className="flex gap-3">
              <button
                disabled={busy || stale}
                onClick={() =>
                  void act({
                    type: "receipt",
                    paymentId: p.id,
                    status: "confirmed",
                  }).catch(() => {})
                }
                className="min-h-11 underline"
              >
                Confirm received
              </button>
              {p.status === "reported" && (
                <button
                  disabled={busy || stale}
                  onClick={() =>
                    void act({
                      type: "receipt",
                      paymentId: p.id,
                      status: "disputed",
                    }).catch(() => {})
                  }
                  className="min-h-11 underline"
                >
                  Dispute
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </article>
  );
}
