"use client";
import { useState } from "react";
import { calculateExpense, itemShare } from "@/lib/pilot/model";
import type { Activity } from "@/lib/activity/model";
import { money } from "./expense-card";
export function RecurringTerms({
  activity,
  email,
  busy,
  onCommand,
  onEdit,
  onRecordActual,
}: {
  activity: Activity;
  email: string;
  busy: boolean;
  onCommand: (value: unknown) => Promise<unknown>;
  onEdit?: () => void;
  onRecordActual?: () => void;
}) {
  const schedule = activity.schedule!;
  const [reviewed, setReviewed] = useState(schedule.version);
  const calculated = calculateExpense(schedule.expense),
    accepted = schedule.accepted.includes(email),
    included = schedule.expense.participants.some((p) => p.email === email),
    stale = reviewed !== schedule.version;
  const waiting = schedule.expense.participants.filter(
    (p) => !schedule.accepted.includes(p.email),
  );
  return (
    <section
      className="sf-response"
      aria-label="Recurring terms"
    >
      <h2 className="font-semibold">{schedule.expense.title} · monthly</h2>
      <p className="mt-2">
        {money(calculated.total)} monthly from {schedule.start}. Due day{" "}
        {schedule.dueDay}.
      </p>
      {included && (
        <p className="mt-3 font-semibold">
          Your recurring share: {money(calculated.shares[email])}
        </p>
      )}
      <p className="mt-2 text-app-muted">
        {schedule.variable
          ? "Variable bill: enter the actual amount each period."
          : "Fixed costs publish automatically after every affected member accepts. Expected payments remain planned until actual costs are recorded."}
      </p>
      <details open={!accepted} className="mt-3">
        <summary className="min-h-11 cursor-pointer py-3">
          People, expected payers and allocation
        </summary>
        {schedule.expense.participants.map((p) => (
          <p key={p.email} className="border-t py-2">
            {p.name}: share {money(calculated.shares[p.email])}
            {p.paid > 0 ? ` · expects to pay ${money(p.paid)}` : ""}
          </p>
        ))}
        {schedule.expense.items.map((item, i) => (
          <div key={i} className="border-t py-2">
            <p>
              {item.name} · {money(item.amount)} ·{" "}
              {item.custom
                ? "Custom amounts"
                : item.units
                  ? "By units"
                  : "Equal shares"}
            </p>
            {schedule.expense.participants.map((p) => (
              <p key={p.email} className="text-xs leading-6 text-app-muted">
                {p.name}:{" "}
                {item.included.includes(p.email)
                  ? `${money(itemShare(item, p.email))}${item.units ? ` (${item.units[p.email]} units)` : ""}`
                  : "Excluded"}
              </p>
            ))}
          </div>
        ))}
      </details>
      <p className="mt-2 font-medium" role="status">
        {schedule.paused
          ? "Schedule paused"
          : waiting.length
            ? `Waiting for ${waiting.map((p) => p.name).join(", ")}`
            : schedule.variable
              ? "Ready for actual costs"
              : "Monthly schedule active"}
      </p>
      <p className="mt-1 text-xs text-app-muted">
        {schedule.accepted.length}/{schedule.expense.participants.length}{" "}
        accepted · Terms v{schedule.version}
      </p>
      {stale && (
        <div role="status" className="mt-3 rounded-lg bg-amber-50 p-3">
          <p>
            The recurring terms changed. Review the amounts and rules above.
          </p>
          <button
            className="min-h-11 underline"
            onClick={() => setReviewed(schedule.version)}
          >
            I reviewed these recurring terms
          </button>
        </div>
      )}
      {!accepted && included && (
        <button
          disabled={busy || stale}
          onClick={() =>
            void onCommand({ type: "acceptTerms", version: reviewed }).catch(
              () => {},
            )
          }
          className="mt-2 min-h-11 rounded-lg bg-slate-900 px-3 text-white"
        >
          Accept recurring terms
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          className="min-h-11 px-3 underline"
        >
          Edit recurring terms
        </button>
      )}
      {schedule.variable &&
        !schedule.paused &&
        !waiting.length &&
        onRecordActual && (
          <button
            type="button"
            disabled={busy}
            onClick={onRecordActual}
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-white"
          >
            Record this period’s cost
          </button>
        )}
      {activity.owner === email && (
        <button
          disabled={busy}
          onClick={() =>
            void onCommand({
              type: "pauseSchedule",
              paused: !schedule.paused,
            }).catch(() => {})
          }
          className="ml-3 min-h-11 underline"
        >
          {schedule.paused ? "Resume schedule" : "Pause schedule"}
        </button>
      )}
      {schedule.paused && (
        <p className="mt-2 text-xs text-app-muted">
          Resuming starts from the next scheduled date. Paused periods are not
          charged retroactively.
        </p>
      )}
    </section>
  );
}
