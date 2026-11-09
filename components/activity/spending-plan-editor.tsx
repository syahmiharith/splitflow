"use client";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/controls/select";
import type { Activity } from "@/lib/activity/model";
import {
  setSpendingPlan,
  spendingPlanChanges,
  summarizeSpendingPlan,
  type SpendingPlan,
} from "@/lib/activity/planning";
import { SpendingPlanCard } from "./spending-plan-card";

const inputClass = "mt-1 block w-full min-w-0 rounded-lg border border-app-border p-3";
type PlanCommand = { type: "plan"; plan: SpendingPlan; reason: string };

/** Optional manual fallback. The same domain parser prepares an explicit local review. */
export function SpendingPlanEditor({
  activity,
  initialPlan,
  initialReason,
  busy,
  onReview,
  onDraftChange,
}: {
  activity: Activity;
  initialPlan?: SpendingPlan;
  initialReason?: string;
  busy: boolean;
  onReview: (command: PlanCommand) => Promise<void>;
  onDraftChange?: (draft: unknown) => void;
}) {
  const seed = initialPlan ?? activity.plan;
  const [limit, setLimit] = useState(String(seed?.limit ?? ""));
  const [categories, setCategories] = useState((seed?.categories ?? []).map(category => ({
    ...category, amount: String(category.amount), key: crypto.randomUUID(),
  })));
  const [reason, setReason] = useState(initialReason ?? (activity.plan ? "" : "Set initial spending plan"));
  const [review, setReview] = useState<PlanCommand>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingGuard = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const callback = useRef(onDraftChange);
  callback.current = onDraftChange;
  useEffect(() => {
    callback.current?.({ kind: "spendingPlan", activityId: activity.id, limit, categories, reason });
  }, [activity.id, limit, categories, reason]);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  const disabled = busy || saving;
  if (review) {
    const classificationChanges = spendingPlanChanges(activity.plan, review.plan).categories
      .filter(category => JSON.stringify(category.previousExpenseIds) !== JSON.stringify(category.expenseIds))
      .map(category => `${category.name} expenses: ${category.expenseIds.map(id => activity.expenses.find(split => split.id === id)?.expense.title ?? id).join(", ") || "none"}`);
    return <section aria-label="Review spending plan" className="sf-flow space-y-3">
      <h3 ref={reviewHeading} tabIndex={-1}>Review spending plan</h3>
      <SpendingPlanCard current={review.plan} previous={activity.plan} summary={summarizeSpendingPlan(review.plan, activity.expenses)} reason={review.reason} classificationChanges={classificationChanges} review />
      {error && <p role="alert" className="text-sm text-app-red">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-app-text px-4 py-3 text-white" disabled={disabled} onClick={async () => {
          if (savingGuard.current) return;
          savingGuard.current = true;
          setSaving(true);
          setError("");
          try { await onReview(review); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this plan."); }
          finally { savingGuard.current = false; setSaving(false); }
        }}>{disabled ? "Saving…" : "Confirm plan"}</button>
        <button type="button" className="rounded-lg px-4 py-3" disabled={disabled} onClick={() => { setReview(undefined); setError(""); }}>Edit plan</button>
      </div>
    </section>;
  }
  return <form className="sf-flow space-y-4 text-sm" onSubmit={event => {
    event.preventDefault();
    setError("");
    try {
      if (!reason.trim()) throw Error("Explain why you are changing the plan.");
      if (categories.some(category => !category.amount.trim())) throw Error("Enter an allowance for each category.");
      const plan = setSpendingPlan({ limit: Number(limit), categories: categories.map(category => ({ name: category.name, amount: Number(category.amount), expenseIds: category.expenseIds })) }, activity.expenses);
      setReview({ type: "plan", plan, reason: reason.trim() });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check the spending plan."); }
  }}>
    <label className="block">Spending limit (KRW)
      <input autoFocus required type="number" min="1" max="1000000000" step="1" inputMode="numeric" value={limit} onChange={event => setLimit(event.target.value)} disabled={disabled} className={inputClass} />
    </label>
    <p className="text-xs text-app-muted">An allowance for this activity, not available cash or a debt.</p>
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-2 font-medium">Categories (optional)</legend>
      {categories.map((category, index) => <div key={category.key} className="space-y-2 border-t border-app-border pt-3">
        <label className="block">Category {index + 1} name
          <input required maxLength={80} value={category.name} onChange={event => setCategories(current => current.map((value, i) => i === index ? { ...value, name: event.target.value } : value))} className={inputClass} />
        </label>
        <label className="block">Category {index + 1} allowance (KRW)
          <input required type="number" min="0" max="1000000000" step="1" inputMode="numeric" value={category.amount} onChange={event => setCategories(current => current.map((value, i) => i === index ? { ...value, amount: event.target.value } : value))} className={inputClass} />
        </label>
        <button type="button" className="min-h-11 px-2 text-app-muted" onClick={() => setCategories(current => current.filter((_, i) => i !== index))}>Remove category {index + 1}</button>
      </div>)}
      <button type="button" disabled={categories.length >= 30} className="min-h-11 rounded-lg border border-app-border px-3" onClick={() => setCategories(current => [...current, { key: crypto.randomUUID(), name: "", amount: "", expenseIds: [] }])}>Add category</button>
    </fieldset>
    {activity.expenses.length > 0 && <details>
      <summary className="min-h-11 cursor-pointer py-3">Assign recorded expenses (optional)</summary>
      <div className="space-y-3">{activity.expenses.map(split => <label key={split.id} className="block">{split.expense.title}
        <Select aria-label={`Category for ${split.expense.title}`} disabled={disabled} className={inputClass} value={categories.find(category => category.expenseIds.includes(split.id))?.key ?? ""} onChange={event => setCategories(current => current.map(category => ({ ...category, expenseIds: category.key === event.target.value ? [...category.expenseIds.filter(id => id !== split.id), split.id] : category.expenseIds.filter(id => id !== split.id) })))}>
          <option value="">Uncategorized</option>
          {categories.map((category, index) => <option key={category.key} value={category.key}>{category.name || `Category ${index + 1}`}</option>)}
        </Select>
      </label>)}</div>
    </details>}
    <label className="block">Reason
      <textarea required maxLength={500} rows={2} value={reason} disabled={disabled} onChange={event => setReason(event.target.value)} className={inputClass} />
    </label>
    {error && <p role="alert" className="text-app-red">{error}</p>}
    <button type="submit" disabled={disabled} className="rounded-lg bg-app-text px-4 py-3 text-white">Review plan</button>
  </form>;
}
