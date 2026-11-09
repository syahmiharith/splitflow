import { z } from "zod";
import type { RecordRow } from "@/lib/activity/client";
import { balances, calculateExpense, claimState } from "@/lib/pilot/model";

export const workspaceReadParameters = {
  type: "object",
  properties: {
    query: { type: ["string", "null"] },
    kind: { type: ["string", "null"], enum: ["group", "activity", "expense", "repayment", "plan", null] },
    recordId: { type: ["string", "null"] },
    cursor: { type: ["string", "null"] },
    mode: { type: ["string", "null"], enum: ["records", "aggregate", null] },
  },
  required: ["query", "kind", "recordId", "cursor", "mode"],
  additionalProperties: false,
};
const request = z.object({
  query: z.string().max(300).nullable().optional(),
  kind: z.enum(["group", "activity", "expense", "repayment", "plan"]).nullable().optional(),
  recordId: z.string().max(80).nullable().optional(),
  cursor: z.string().max(80).nullable().optional(),
  mode: z.enum(["records", "aggregate"]).nullable().optional(),
}).strict();
type Entry = { id: string; kind: string; activityId?: string; row: RecordRow; data: unknown; search: string };
function entries(rows: RecordRow[], kind: string | null | undefined): Entry[] {
  return rows.flatMap<Entry>(row => {
    const d = row.document;
    const base = { row, search: JSON.stringify(d).toLocaleLowerCase("en-US") };
    if (!kind || kind === row.kind) return [{ ...base, id: d.id, kind: row.kind, data: row }];
    if (row.kind !== "activity") return [];
    const a = row.document;
    if (kind === "expense") return a.expenses.map(s => ({ ...base, search: JSON.stringify(s).toLocaleLowerCase("en-US"), id: s.id, kind, activityId: a.id, data: { ...s, calculation: calculateExpense(s.expense), balances: balances(s), claimState: claimState(s) } }));
    if (kind === "repayment") return a.expenses.flatMap(s => s.repayments.map(p => ({ ...base, search: JSON.stringify(p).toLocaleLowerCase("en-US"), id: p.id, kind, activityId: a.id, data: { ...p, expenseId: s.id } })));
    if (kind === "plan" && a.plan) return [{ ...base, id: a.id, kind, activityId: a.id, data: a.plan }];
    return [];
  });
}
function fingerprint(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
/** The caller supplies authorized rows only; never fetch records by model-supplied owner. */
export function readWorkspace(input: unknown, rows: RecordRow[], activityId: string | null, render: (rows: RecordRow[]) => unknown) {
  const args = request.parse(input);
  const query = args.query?.trim().toLocaleLowerCase("en-US") ?? "";
  const matched = entries(rows, args.kind).filter(e =>
    args.recordId ? e.id === args.recordId : !query || e.search.includes(query),
  ).sort((a,b) => Number(b.id === activityId) - Number(a.id === activityId) || a.id.localeCompare(b.id));
  const version = fingerprint(JSON.stringify([args.query, args.kind, args.recordId, matched.map(e => [e.id, e.row.document.revision])]));
  let offset = 0;
  if (args.cursor) {
    const [position, snapshot] = args.cursor.split(":");
    offset = Number(position);
    if (!/^\d+$/.test(position) || !Number.isSafeInteger(offset) || snapshot !== version || offset > matched.length)
      throw Error("Workspace changed or cursor is invalid. Restart the search.");
  }
  if (args.mode === "aggregate") {
    const groupIds = new Set(matched.filter(e => e.kind === "group").map(e => e.id));
    const activityIds = new Set(matched.filter(e => e.row.kind === "activity").map(e => e.row.document.id));
    const activities = rows.filter((row): row is Extract<RecordRow, {kind:"activity"}> => row.kind === "activity" && (activityIds.has(row.document.id) || !!row.document.groupId && groupIds.has(row.document.groupId)));
    const ids = new Set(matched.map(e => e.id));
    const totals: Record<string, { reportedCost: number; plannedCost: number; confirmedTransfers: number; reportedTransfers: number; disputedTransfers: number; agreedBalances: Record<string, number> }> = {};
    for (const {document:a} of activities) for (const s of a.expenses) {
      if (args.kind === "expense" && !ids.has(s.id)) continue;
      // Existing shared records are KRW; explicit currency supports additive migration.
      const currency = (s.expense as typeof s.expense & {currency?:string}).currency ?? "KRW";
      const t = totals[currency] ??= {reportedCost:0,plannedCost:0,confirmedTransfers:0,reportedTransfers:0,disputedTransfers:0,agreedBalances:{}};
      if (args.kind !== "repayment") {
        t[s.expense.mode === "paid" ? "reportedCost" : "plannedCost"] += calculateExpense(s.expense).total;
        for (const [email, amount] of Object.entries(balances(s))) t.agreedBalances[email] = (t.agreedBalances[email] ?? 0) + amount;
      }
      for (const p of s.repayments) if (args.kind !== "repayment" || ids.has(p.id)) t[p.status === "confirmed" ? "confirmedTransfers" : p.status === "disputed" ? "disputedTransfers" : "reportedTransfers"] += p.amount;
    }
    return { matchedCount: matched.length, complete: true, scope: "All authorized matches; reported costs are claims, not agreements", totals };
  }
  const page = matched.slice(offset, offset + 20);
  const nextCursor = offset + page.length < matched.length ? `${offset + page.length}:${version}` : null;
  const result = { records: !args.kind || ["group","activity"].includes(args.kind) ? render(page.map(e => e.row)) : page.map(({id,kind,activityId,data}) => ({id,kind,activityId,data})), matchedCount: matched.length, nextCursor, moreAvailable: nextCursor !== null, complete: nextCursor === null && offset === 0 };
  if (JSON.stringify(result).length > 70000) throw Error("Results are too large. Search a specific expense, repayment or plan instead of full activities.");
  return result;
}
