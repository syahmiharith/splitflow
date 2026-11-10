import { z } from "zod";
import { currencyMinorUnits, sumMoney } from "./money";

const id = z.string().min(1).max(100);
const amount = z.number().int().safe();
const positive = amount.positive();
const currency = z.string().refine(value => { try { currencyMinorUnits(value); return true; } catch { return false; } }, "Unsupported currency");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Invalid date");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const name = z.string().trim().min(1).max(120);
export const accountSchema = z.object({ id, name, kind: z.enum(["cash", "bank", "credit"]), currency, openingBalance: amount, archived: z.boolean().default(false) });
export const categorySchema = z.object({ id, name, currency, archived: z.boolean().default(false) });
const split = z.object({ categoryId: id, amount: positive });
export const transactionSchema = z.object({
  id, accountId: id, date, amount: amount.refine(value => value !== 0, "Enter a nonzero amount"),
  kind: z.enum(["income", "expense", "refund", "reimbursement", "adjustment"]), payee: name,
  cleared: z.boolean().default(true), splits: z.array(split).default([]),
  sharedExpenseId: id.optional(), sharedRepaymentId: id.optional(), importKey: id.optional(),
  originalTransactionId: id.optional(), reimbursableAmount: amount.nonnegative().optional(),
});
export const scheduleSchema = z.object({ id, name, accountId: id, amount: positive, kind: z.enum(["income", "expense"]), categoryId: id.optional(), start: date, frequency: z.enum(["weekly", "monthly", "yearly"]), paused: z.boolean().default(false) });
export const financeCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("account"), account: accountSchema }),
  z.object({ type: z.literal("category"), category: categorySchema }),
  z.object({ type: z.literal("rename"), kind: z.enum(["account", "category"]), id, name }),
  z.object({ type: z.literal("transaction"), transaction: transactionSchema }),
  z.object({ type: z.literal("voidTransaction"), id, reason: name }),
  z.object({ type: z.literal("voidTransfer"), id, reason: name }),
  z.object({ type: z.literal("categorize"), id, splits: z.array(split) }),
  z.object({ type: z.literal("linkSharedExpense"), id, sharedExpenseId: id, reimbursableAmount: amount.nonnegative(), splits: z.array(split) }),
  z.object({ type: z.literal("classifyReimbursement"), id, sharedRepaymentId: id, originalTransactionId: id }),
  z.object({ type: z.literal("clear"), id, cleared: z.boolean() }),
  z.object({ type: z.literal("transfer"), id, from: id, to: id, date, sourceAmount: positive, destinationAmount: positive, fee: amount.nonnegative().default(0), feeCategoryId: id.optional() }),
  z.object({
    type: z.literal("allocate"), categoryId: id, month,
    mode: z.enum(["change", "setMonthly"]).optional().describe("Use setMonthly when the user gives the desired total allocation for this month, such as reduce November Food from 300000 to 250000. Use change for add/remove/move an explicit amount. Omitted mode preserves legacy change behavior."),
    amount: amount.describe("Integer minor units. With setMonthly this is the desired total allocated in the selected month, not the remaining balance. With change or omitted mode this is a SIGNED DELTA: positive adds funds, negative releases funds. Never pass a new target total as a positive change."),
  }),
  z.object({ type: z.literal("allocateCardPayment"), accountId: id, amount: amount.describe("Signed change in integer minor units: positive reserves additional cash for the card payment; negative releases reserved cash. This is not a target balance or an actual card payment.") }),
  z.object({ type: z.literal("goal"), id, name, categoryId: id, target: positive, targetDate: date }),
  z.object({ type: z.literal("schedule"), schedule: scheduleSchema }),
  z.object({ type: z.literal("pauseSchedule"), id, paused: z.boolean() }),
  z.object({ type: z.literal("skipOccurrence"), id, date }),
  z.object({ type: z.literal("recordOccurrence"), id: id.describe("Existing schedule ID from read_finance schedules."), date: date.describe("Expected occurrence date, distinct from the actual payment date."), actualDate: date, actualAmount: positive, transactionId: id.describe("New unique temporary transaction alias, never an existing transaction ID. The server creates the recorded transaction.") }),
  z.object({ type: z.literal("reconcile"), accountId: id, date, statedBalance: amount, adjustmentId: id, reason: name }),
  z.object({ type: z.literal("archive"), kind: z.enum(["account", "category"]), id, archived: z.boolean() }),
]);
export type FinanceCommand = z.infer<typeof financeCommandSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Transaction = z.infer<typeof transactionSchema> & { transferId?: string; voided?: string; paymentReserved?: number; paidAmount?: number; reserveReleased?: Record<string, number>; settledTransactions?: Record<string, number> };
export type FinanceState = {
  accounts: Account[]; categories: z.infer<typeof categorySchema>[]; transactions: Transaction[];
  allocations: { categoryId: string; month: string; amount: number }[];
  cardPayments: Record<string, number>;
  goals: { id: string; name: string; categoryId: string; target: number; targetDate: string }[];
  schedules: (z.infer<typeof scheduleSchema> & { occurrences: Record<string, "skipped" | string> })[];
  reconciliations: { accountId: string; date: string; statedBalance: number; adjustmentId: string; reason: string }[];
};
export function emptyFinance(): FinanceState { return { accounts: [], categories: [], transactions: [], allocations: [], cardPayments: {}, goals: [], schedules: [], reconciliations: [] }; }
function find<T extends { id: string }>(values: T[], id: string): T { const value = values.find(item => item.id === id); if (!value) throw Error("Record unavailable."); return value; }
function account(state: FinanceState, id: string) { const value = find(state.accounts, id); if (value.archived) throw Error("Restore this account first."); return value; }
export function today(): string { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); }
export function accountBalance(state: FinanceState, accountId: string, clearedOnly = false, asOf = today()): number {
  return sumMoney([find(state.accounts, accountId).openingBalance, ...state.transactions.filter(t => t.accountId === accountId && !t.voided && t.date <= asOf && (!clearedOnly || t.cleared)).map(t => t.amount)]);
}
export function categoryAvailable(state: FinanceState, categoryId: string, throughMonth = today().slice(0, 7)): number {
  return sumMoney([
    ...state.allocations.filter(a => a.categoryId === categoryId && a.month <= throughMonth).map(a => a.amount),
    ...state.transactions.filter(t => !t.voided && t.date <= today() && t.date.slice(0, 7) <= throughMonth).flatMap(t => t.splits.filter(s => s.categoryId === categoryId).map(s => t.kind === "refund" ? s.amount : -s.amount)),
  ]);
}
/** Future assignments reserve current cash; later releases cannot free an earlier month's allocation. */
function reservedCategoryFunds(state: FinanceState, categoryId: string): number {
  const currentMonth = today().slice(0, 7);
  let balance = categoryAvailable(state, categoryId, currentMonth);
  let reserved = Math.max(0, balance);
  const future = new Map<string, number[]>();
  for (const allocation of state.allocations.filter(a => a.categoryId === categoryId && a.month > currentMonth))
    future.set(allocation.month, [...(future.get(allocation.month) ?? []), allocation.amount]);
  for (const month of [...future.keys()].sort()) {
    balance = sumMoney([balance, ...future.get(month)!]);
    reserved = Math.max(reserved, balance);
  }
  return reserved;
}
export function financeSummary(state: FinanceState, throughMonth = today().slice(0, 7)) {
  return [...new Set(state.accounts.map(a => a.currency))].map(currency => {
    const accounts = state.accounts.filter(a => a.currency === currency);
    const cash = sumMoney(accounts.filter(a => a.kind !== "credit").map(a => sumMoney([accountBalance(state, a.id, true), ...state.transactions.filter(t => t.accountId === a.id && !t.voided && !t.cleared && t.amount < 0 && t.date <= today()).map(t => t.amount)])));
    const creditLiability = sumMoney(accounts.filter(a => a.kind === "credit").map(a => Math.max(0, -accountBalance(state, a.id))));
    const cardPaymentAllocation = sumMoney(accounts.filter(a => a.kind === "credit").map(a => state.cardPayments[a.id] ?? 0));
    const categories = state.categories.filter(c => c.currency === currency).map(c => ({ ...c, available: categoryAvailable(state, c.id, throughMonth) }));
    // Overspending remains visible and consumes available cash; never silently cover it.
    const assigned = sumMoney(categories.map(c => reservedCategoryFunds(state, c.id)));
    const receivable = sumMoney(state.transactions.filter(t => !t.voided && t.date <= today() && accounts.some(a => a.id === t.accountId)).map(t => t.kind === "expense" ? t.reimbursableAmount ?? 0 : t.kind === "reimbursement" && t.cleared ? -t.amount : 0));
    return { currency, cash, creditLiability, cardPaymentAllocation, receivable, readyToAssign: sumMoney([cash, -assigned, -cardPaymentAllocation]), categories };
  });
}
function validateSplits(state: FinanceState, t: Transaction) {
  const a = account(state, t.accountId);
  if (t.splits.length && !["expense", "refund"].includes(t.kind)) throw Error("Only expenses and refunds have spending categories.");
  if ((t.reimbursableAmount ?? 0) > Math.abs(t.amount) || (t.reimbursableAmount && (!t.sharedExpenseId || t.kind !== "expense"))) throw Error("Receivable must belong to a linked shared expense and fit its amount.");
  if (t.splits.length && sumMoney(t.splits.map(s => s.amount)) !== Math.abs(t.amount) - (t.reimbursableAmount ?? 0)) throw Error("Category amounts must equal the personal portion of the transaction.");
  if (new Set(t.splits.map(s => s.categoryId)).size !== t.splits.length) throw Error("Use one row per category.");
  for (const split of t.splits) { const c = find(state.categories, split.categoryId); if (c.archived || c.currency !== a.currency) throw Error("Choose an active category in the account currency."); }
}
function releaseReserve(state: FinanceState, accountId: string, amount: number, originalId?: string) {
  const released: Record<string, number> = {};
  let left = Math.min(state.cardPayments[accountId] ?? 0, amount);
  const total = left;
  const rows = state.transactions.filter(t => t.accountId === accountId && !t.voided && (t.paymentReserved ?? 0) > 0).sort((a,b) => Number(b.id === originalId) - Number(a.id === originalId) || a.date.localeCompare(b.date));
  for (const row of rows) { const used = Math.min(left, row.paymentReserved!); row.paymentReserved! -= used; released[row.id] = used; left -= used; if (!left) break; }
  state.cardPayments[accountId] = (state.cardPayments[accountId] ?? 0) - total;
  return { total, released };
}
function addTransaction(state: FinanceState, t: Transaction) {
  if (state.transactions.some(row => row.id === t.id || (t.importKey && row.importKey === t.importKey))) throw Error("Transaction already recorded.");
  if ((t.kind === "expense" && t.amount > 0) || (["income", "refund", "reimbursement"].includes(t.kind) && t.amount < 0)) throw Error("Transaction direction does not match its kind.");
  validateSplits(state, t);
  const a = account(state, t.accountId);
  if (a.kind === "credit" && t.date > today()) throw Error("Schedule future card activity instead of recording it as actual spending.");
  if (t.kind === "reimbursement") {
    const original = find(state.transactions, t.originalTransactionId ?? "");
    if (state.transactions.some(row => !row.voided && row.sharedRepaymentId === t.sharedRepaymentId)) throw Error("Repayment is already linked to a transaction.");
    if (!t.sharedRepaymentId || !original.sharedExpenseId || original.voided || account(state, original.accountId).currency !== a.currency) throw Error("Link an existing shared expense and a confirmed same-currency repayment.");
    const recovered = sumMoney(state.transactions.filter(row => !row.voided && row.kind === "reimbursement" && row.originalTransactionId === original.id).map(row => row.amount));
    if (recovered + t.amount > (original.reimbursableAmount ?? 0)) throw Error("Reimbursement exceeds the linked receivable.");
  }
  if (t.date <= today() && a.kind === "credit" && t.kind === "expense") {
    const funded = sumMoney(t.splits.map(s => Math.min(s.amount, Math.max(0, categoryAvailable(state, s.categoryId)))));
    state.cardPayments[a.id] = sumMoney([state.cardPayments[a.id] ?? 0, funded]);
    t.paymentReserved = funded;
  }
  if (t.date <= today() && a.kind === "credit" && t.kind === "refund") {
    const released = releaseReserve(state, a.id, t.amount, t.originalTransactionId);
    t.paymentReserved = -released.total;
    t.reserveReleased = released.released;
  }
  state.transactions.push(t);
}
export function isOccurrence(schedule: z.infer<typeof scheduleSchema>, value: string): boolean {
  if (value < schedule.start) return false;
  const start = new Date(`${schedule.start}T00:00:00Z`), day = new Date(`${value}T00:00:00Z`);
  if (schedule.frequency === "weekly") return (day.getTime() - start.getTime()) % (7 * 86400000) === 0;
  if (schedule.frequency === "yearly" && day.getUTCMonth() !== start.getUTCMonth()) return false;
  const last = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
  return day.getUTCDate() === Math.min(start.getUTCDate(), last);
}
/** Earliest expected occurrence still requiring action; overdue periods never disappear silently. */
export function nextOccurrence(schedule: FinanceState["schedules"][number], asOf = today()): { date: string; status: "overdue" | "due" | "upcoming" } | null {
  date.parse(asOf);
  if (schedule.paused) return null;
  const start = new Date(`${schedule.start}T00:00:00Z`);
  // At most N handled dates can precede the next unhandled date.
  for (let index = 0; index <= Object.keys(schedule.occurrences).length; index++) {
    let candidate: Date;
    if (schedule.frequency === "weekly") candidate = new Date(start.getTime() + index * 7 * 86400000);
    else {
      const monthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth() + index * (schedule.frequency === "yearly" ? 12 : 1);
      const year = Math.floor(monthIndex / 12), month = monthIndex % 12;
      if (year > 9999) return null;
      const lastDay = new Date(`${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`);
      lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
      candidate = new Date(`${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(Math.min(start.getUTCDate(), lastDay.getUTCDate())).padStart(2, "0")}T00:00:00Z`);
    }
    if (Number.isNaN(candidate.getTime()) || candidate.getUTCFullYear() > 9999) return null;
    const value = candidate.toISOString().slice(0, 10);
    if (schedule.occurrences[value]) continue;
    return { date: value, status: value < asOf ? "overdue" : value === asOf ? "due" : "upcoming" };
  }
  return null;
}
export function applyFinanceCommand(current: FinanceState, raw: unknown): FinanceState {
  const command = financeCommandSchema.parse(raw), state = structuredClone(current);
  switch (command.type) {
    case "account": {
      if (state.accounts.some(a => a.id === command.account.id)) throw Error("Account already exists.");
      state.accounts.push(command.account); break;
    }
    case "category": {
      if (state.categories.some(c => c.id === command.category.id)) throw Error("Category already exists.");
      state.categories.push(command.category); break;
    }
    case "transaction": addTransaction(state, command.transaction); break;
    case "voidTransaction": {
      const t = find(state.transactions, command.id);
      if (t.transferId) throw Error("Transfer corrections require both account entries.");
      if (t.voided) throw Error("Transaction already voided.");
      if (state.transactions.some(row => !row.voided && row.kind === "reimbursement" && row.originalTransactionId === t.id)) throw Error("Correct linked reimbursements before voiding their expense.");
      if (find(state.accounts, t.accountId).kind === "credit") state.cardPayments[t.accountId] = Math.max(0, (state.cardPayments[t.accountId] ?? 0) - (t.paymentReserved ?? 0));
      if (t.reserveReleased) for (const [id, amount] of Object.entries(t.reserveReleased)) { const original = find(state.transactions, id); if (!original.voided) original.paymentReserved = sumMoney([original.paymentReserved ?? 0, amount]); }
      t.voided = command.reason; break;
    }
    case "voidTransfer": {
      const rows = state.transactions.filter(t => t.transferId === command.id);
      if (rows.length < 2 || rows.some(t => t.voided)) throw Error("Transfer unavailable or already corrected.");
      for (const t of rows) {
        if (t.amount > 0 && find(state.accounts, t.accountId).kind === "credit") {
          state.cardPayments[t.accountId] = sumMoney([state.cardPayments[t.accountId] ?? 0, -(t.paymentReserved ?? 0)]);
          for (const [id, amount] of Object.entries(t.reserveReleased ?? {})) { const original = find(state.transactions, id); if (!original.voided) original.paymentReserved = sumMoney([original.paymentReserved ?? 0, amount]); }
          for (const [id, amount] of Object.entries(t.settledTransactions ?? {})) { const original = find(state.transactions, id); original.paidAmount = Math.max(0, (original.paidAmount ?? 0) - amount); }
        }
        t.voided = command.reason;
      }
      break;
    }
    case "linkSharedExpense": case "categorize": {
      const t = find(state.transactions, command.id);
      if (t.voided || t.transferId) throw Error("This entry cannot be categorized.");
      if (command.type === "linkSharedExpense") {
        const recovered = sumMoney(state.transactions.filter(row => !row.voided && row.kind === "reimbursement" && row.originalTransactionId === t.id).map(row => row.amount));
        if (recovered > command.reimbursableAmount || (recovered && t.sharedExpenseId !== command.sharedExpenseId)) throw Error("Correct linked reimbursements before changing their source expense.");
        t.sharedExpenseId = command.sharedExpenseId; t.reimbursableAmount = command.reimbursableAmount;
      }
      const card = find(state.accounts, t.accountId).kind === "credit";
      if (card && t.kind === "expense") {
        state.cardPayments[t.accountId] = Math.max(0, (state.cardPayments[t.accountId] ?? 0) - (t.paymentReserved ?? 0));
        t.voided = "Recategorizing";
        t.paymentReserved = t.date <= today() ? Math.min(Math.max(0, -t.amount - (t.paidAmount ?? 0)), sumMoney(command.splits.map(s => Math.min(s.amount, Math.max(0, categoryAvailable(state, s.categoryId)))))) : 0;
        delete t.voided;
        state.cardPayments[t.accountId] = sumMoney([state.cardPayments[t.accountId] ?? 0, t.paymentReserved]);
      }
      t.splits = command.splits; validateSplits(state, t); break;
    }
    case "classifyReimbursement": {
      const original = find(state.transactions, command.id);
      if (original.voided || original.transferId || original.amount <= 0 || original.kind !== "income") throw Error("Select an incoming transaction that is currently classified as income.");
      state.transactions = state.transactions.filter(t => t.id !== original.id);
      addTransaction(state, { ...original, kind: "reimbursement", sharedRepaymentId: command.sharedRepaymentId, originalTransactionId: command.originalTransactionId, splits: [] });
      break;
    }
    case "clear": find(state.transactions, command.id).cleared = command.cleared; break;
    case "transfer": {
      const from = account(state, command.from), to = account(state, command.to);
      if (from.id === to.id) throw Error("Choose different accounts.");
      if (from.currency === to.currency && command.sourceAmount !== command.destinationAmount) throw Error("Same-currency transfer amounts must match.");
      const base = { date: command.date, kind: "adjustment" as const, cleared: true, splits: [], transferId: command.id };
      addTransaction(state, { ...base, id: `${command.id}:out`, accountId: from.id, amount: -command.sourceAmount, payee: to.name });
      addTransaction(state, { ...base, id: `${command.id}:in`, accountId: to.id, amount: command.destinationAmount, payee: from.name });
      if (to.kind === "credit") {
        const released = releaseReserve(state, to.id, command.destinationAmount);
        const incoming = find(state.transactions, `${command.id}:in`);
        incoming.paymentReserved = -released.total; incoming.reserveReleased = released.released; incoming.settledTransactions = {};
        let left = command.destinationAmount;
        for (const t of state.transactions.filter(t => t.accountId === to.id && t.kind === "expense" && !t.voided).sort((a,b) => a.date.localeCompare(b.date))) {
          const paid = Math.min(left, Math.max(0, -t.amount - (t.paidAmount ?? 0))); t.paidAmount = (t.paidAmount ?? 0) + paid; incoming.settledTransactions[t.id] = paid; left -= paid; if (!left) break;
        }
      }
      if (command.fee) addTransaction(state, { id: `${command.id}:fee`, transferId: command.id, accountId: from.id, amount: -command.fee, kind: "expense", date: command.date, cleared: true, payee: "Transfer fee", splits: command.feeCategoryId ? [{ categoryId: command.feeCategoryId, amount: command.fee }] : [] });
      break;
    }
    case "allocate": {
      const c = find(state.categories, command.categoryId);
      if (c.archived) throw Error("Restore this category first.");
      if (command.mode === "setMonthly" && command.amount < 0) throw Error("Monthly allocation target cannot be negative.");
      const monthlyAllocation = sumMoney(state.allocations.filter(a => a.categoryId === c.id && a.month === command.month).map(a => a.amount));
      const change = command.mode === "setMonthly" ? sumMoney([command.amount, -monthlyAllocation]) : command.amount;
      if (change < 0 && categoryAvailable(state, c.id, command.month) + change < 0) throw Error("Cannot remove more than the category has available.");
      const available = financeSummary(state, command.month).find(s => s.currency === c.currency)?.readyToAssign ?? 0;
      if (change > 0 && change > available) throw Error("Record funds or release another allocation first.");
      if (change) state.allocations.push({ categoryId: c.id, month: command.month, amount: change }); break;
    }
    case "allocateCardPayment": {
      const a = account(state, command.accountId);
      if (a.kind !== "credit") throw Error("Choose a credit-card account.");
      const available = financeSummary(state).find(s => s.currency === a.currency)!.readyToAssign;
      if ((command.amount > 0 && command.amount > available) || (state.cardPayments[a.id] ?? 0) + command.amount < 0) throw Error("Payment allocation exceeds available funds.");
      state.cardPayments[a.id] = sumMoney([state.cardPayments[a.id] ?? 0, command.amount]); break;
    }
    case "goal": {
      find(state.categories, command.categoryId);
      state.goals = state.goals.filter(g => g.id !== command.id);
      const { type: _type, ...goal } = command; void _type; state.goals.push(goal); break;
    }
    case "schedule": {
      const a = account(state, command.schedule.accountId);
      if (command.schedule.categoryId && find(state.categories, command.schedule.categoryId).currency !== a.currency) throw Error("Schedule category currency does not match.");
      const previous = state.schedules.find(s => s.id === command.schedule.id);
      state.schedules = state.schedules.filter(s => s.id !== command.schedule.id);
      state.schedules.push({ ...command.schedule, occurrences: previous?.occurrences ?? {} }); break;
    }
    case "pauseSchedule": find(state.schedules, command.id).paused = command.paused; break;
    case "skipOccurrence": case "recordOccurrence": {
      const s = find(state.schedules, command.id);
      if (s.paused) throw Error("Schedule is paused. Resume it before recording or skipping an occurrence.");
      if (!isOccurrence(s, command.date)) throw Error("Occurrence date is invalid for this schedule. Choose an expected date.");
      if (s.occurrences[command.date]) throw Error("This occurrence has already been recorded or skipped.");
      if (command.type === "skipOccurrence") s.occurrences[command.date] = "skipped";
      else {
        addTransaction(state, { id: command.transactionId, accountId: s.accountId, date: command.actualDate, amount: s.kind === "income" ? command.actualAmount : -command.actualAmount, kind: s.kind, payee: s.name, cleared: true, splits: s.categoryId && s.kind === "expense" ? [{ categoryId: s.categoryId, amount: command.actualAmount }] : [] });
        s.occurrences[command.date] = command.transactionId;
      } break;
    }
    case "reconcile": {
      account(state, command.accountId);
      const delta = sumMoney([command.statedBalance, -accountBalance(state, command.accountId, true, command.date)]);
      if (delta) addTransaction(state, { id: command.adjustmentId, accountId: command.accountId, date: command.date, amount: delta, kind: "adjustment", payee: command.reason, cleared: true, splits: [] });
      const { type: _type, ...reconciliation } = command; void _type; state.reconciliations.push(reconciliation); break;
    }
    case "rename": {
      const value = command.kind === "account" ? find(state.accounts, command.id) : find(state.categories, command.id);
      value.name = command.name; break;
    }
    case "archive": {
      const value = command.kind === "account" ? find(state.accounts, command.id) : find(state.categories, command.id);
      value.archived = command.archived; break;
    }
  }
  for (const a of state.accounts) {
    const balance = accountBalance(state, a.id);
    if (a.kind === "credit") state.cardPayments[a.id] = Math.min(state.cardPayments[a.id] ?? 0, Math.max(0, -balance));
  }
  return state;
}
