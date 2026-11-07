"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { calculateExpense, type Expense, type Split } from "@/lib/pilot/model";
import { nextAction } from "@/lib/pilot/next-action";
const money = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
export function ConversationPreview({
  draft,
  split,
  email,
  disabled,
  onReview,
}: {
  draft: Expense;
  split?: Split;
  email: string;
  disabled: boolean;
  onReview: () => void;
}) {
  const allocation = calculateExpense(draft);
  return (
    <section
      aria-label="Current split preview"
      className="mb-6 rounded-xl border border-app-border bg-white p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-app-muted">
            {split ? "Published split" : "Draft · Only you can see this"}
          </p>
          <h2 className="mt-2 break-words text-lg font-semibold">
            {draft.title}
          </h2>
          <p className="mt-1 text-sm text-app-muted">
            {draft.participants.length} people ·{" "}
            {draft.mode === "paid" ? "Already paid" : "Planned expense"}
          </p>
        </div>
        <p className="shrink-0 text-xl font-semibold tabular-nums">
          {money(allocation.total)}
        </p>
      </div>
      <ul className="mt-4 divide-y divide-app-border">
        {draft.participants.map((p) => (
          <li key={p.email} className="flex justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 break-words">
              {p.email === email ? "You" : p.name}
            </span>
            <span className="shrink-0 tabular-nums">
              {money(allocation.shares[p.email])}
            </span>
          </li>
        ))}
      </ul>
      {split ? (
        <>
          <p className="mt-3 text-sm">{nextAction(split, email)}</p>
          <Link
            href={`/?split=${split.id}`}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-app-blue hover:bg-blue-700 border-transparent px-4 text-sm font-semibold text-white"
          >
            Open split details
            <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="mt-2 text-xs leading-5 text-app-muted">
            Invitations, responses, corrections, repayment confirmations and
            history.
          </p>
        </>
      ) : (
        <button
          onClick={onReview}
          disabled={disabled}
          className="mt-4 min-h-11 rounded-lg bg-app-blue hover:bg-blue-700 border-transparent px-4 text-sm font-semibold text-white"
        >
          Review split
        </button>
      )}
    </section>
  );
}
