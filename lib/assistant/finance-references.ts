import { type FinanceCommand, type FinanceState } from "@/lib/finance/model";

/** Resolve only exact authorized names; ambiguity is a clarification, never a guess. */
export function resolveFinanceReferences(command: FinanceCommand, state: FinanceState): FinanceCommand {
  const resolve = (value: string, rows: {id:string;name?:string;payee?:string}[], kind: string, allowNew = false) => {
    if (rows.some(row => row.id === value)) return value;
    const matches = rows.filter(row => (row.name ?? row.payee ?? "").trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase());
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) throw Error(`Ambiguous ${kind} name "${value}". Ask which record the user means; use read_finance to distinguish the matches.`);
    if (allowNew) return value;
    throw Error(`${kind} unavailable. Use an exact authorized name or ID; ask for clarification rather than inventing an ID.`);
  };
  const result = structuredClone(command);
  // Creation identifiers remain aliases. Update-capable schedules/goals can use existing names.
  if (result.type === "schedule") result.schedule.id = resolve(result.schedule.id, state.schedules, "Schedule", true);
  if (result.type === "goal") result.id = resolve(result.id, state.goals, "Goal", true);
  if (["pauseSchedule", "skipOccurrence", "recordOccurrence"].includes(result.type) && "id" in result) result.id = resolve(result.id, state.schedules, "Schedule");
  if ((result.type === "rename" || result.type === "archive")) result.id = resolve(result.id, result.kind === "account" ? state.accounts : state.categories, result.kind);
  if (["voidTransaction", "categorize", "linkSharedExpense", "classifyReimbursement", "clear"].includes(result.type) && "id" in result) result.id = resolve(result.id, state.transactions, "Transaction");
  const walk = (value: unknown): unknown => Array.isArray(value) ? value.map(walk) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, val]) => {
    if (typeof val === "string") {
      if (["accountId", "from", "to"].includes(key)) return [key, resolve(val, state.accounts, "Account")];
      if (["categoryId", "feeCategoryId"].includes(key)) return [key, resolve(val, state.categories, "Category")];
      if (key === "originalTransactionId") return [key, resolve(val, state.transactions, "Transaction")];
    }
    return [key, walk(val)];
  })) : value;
  return walk(result) as FinanceCommand;
}
