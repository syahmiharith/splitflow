import { describe, expect, it } from "vitest";
import { applyFinanceCommand as apply, emptyFinance, accountBalance, financeSummary, categoryAvailable } from "@/lib/finance/model";
import { parseMoney } from "@/lib/finance/money";
function fixture() {
  let state = apply(emptyFinance(), { type: "account", account: { id: "bank", name: "Bank", kind: "bank", currency: "USD", openingBalance: 100000 } });
  state = apply(state, { type: "account", account: { id: "card", name: "Card", kind: "credit", currency: "USD", openingBalance: 0 } });
  return apply(state, { type: "category", category: { id: "food", name: "Food", currency: "USD" } });
}
describe("personal finance", () => {
  it("parses currency precision without rounding away money", () => {
    expect(parseMoney("10.25", "USD")).toBe(1025);
    expect(parseMoney("1000", "KRW")).toBe(1000);
    expect(parseMoney("1.234", "KWD")).toBe(1234);
    expect(() => parseMoney("1.2", "KRW")).toThrow();
    expect(() => parseMoney("1", "XYZ")).toThrow();
  });
  it("moves funded card spending to payment reserve and does not count the payment twice", () => {
    let s = apply(fixture(), { type: "allocate", categoryId: "food", month: "2026-11", amount: 20000 });
    s = apply(s, { type: "transaction", transaction: { id: "dinner", accountId: "card", date: "2026-11-10", amount: -5000, kind: "expense", payee: "Dinner", splits: [{ categoryId: "food", amount: 5000 }] } });
    expect(categoryAvailable(s, "food")).toBe(15000);
    expect(financeSummary(s)[0]).toMatchObject({ readyToAssign: 80000, cardPaymentAllocation: 5000, creditLiability: 5000 });
    s = apply(s, { type: "transfer", id: "pay", from: "bank", to: "card", date: "2026-11-10", sourceAmount: 5000, destinationAmount: 5000 });
    expect(accountBalance(s, "bank")).toBe(95000);
    expect(accountBalance(s, "card")).toBe(0);
    expect(categoryAvailable(s, "food")).toBe(15000);
    expect(financeSummary(s)[0].readyToAssign).toBe(80000);
  });
  it("preserves separate currencies and requires actual exchange amounts", () => {
    let s = apply(fixture(), { type: "account", account: { id: "won", name: "Won", kind: "bank", currency: "KRW", openingBalance: 0 } });
    s = apply(s, { type: "transfer", id: "exchange", from: "bank", to: "won", sourceAmount: 10000, destinationAmount: 130000, fee: 100, date: "2026-11-10" });
    expect(financeSummary(s).map(v => [v.currency, v.cash])).toEqual([["USD", 89900], ["KRW", 130000]]);
    expect(() => apply(s, { type: "transaction", transaction: { id: "bad", accountId: "won", date: "2026-11-10", amount: -1000, kind: "expense", payee: "Food", splits: [{ categoryId: "food", amount: 1000 }] } })).toThrow(/currency/);
  });
  it("rolls allocations forward, rejects unfunded assignments and exposes overspending", () => {
    let s = apply(fixture(), { type: "allocate", categoryId: "food", month: "2026-10", amount: 5000 });
    expect(categoryAvailable(s, "food", "2026-11")).toBe(5000);
    expect(() => apply(s, { type: "allocate", categoryId: "food", month: "2026-11", amount: 100000 })).toThrow();
    s = apply(s, { type: "transaction", transaction: { id: "expense", accountId: "bank", date: "2026-11-10", amount: -7000, kind: "expense", payee: "Food", splits: [{ categoryId: "food", amount: 7000 }] } });
    expect(categoryAvailable(s, "food")).toBe(-2000);
  });
  it("records occurrences once and clamps month-end dates", () => {
    let s = apply(fixture(), { type: "schedule", schedule: { id: "bill", name: "Bill", accountId: "bank", amount: 1000, kind: "expense", start: "2026-01-31", frequency: "monthly" } });
    const command = { type: "recordOccurrence", id: "bill", date: "2026-02-28", actualDate: "2026-03-01", actualAmount: 1200, transactionId: "paid" };
    s = apply(s, command);
    expect(accountBalance(s, "bank")).toBe(98800);
    expect(() => apply(s, command)).toThrow(/already/);
    expect(() => apply(s, { ...command, date: "2026-03-28", transactionId: "bad" })).toThrow(/invalid/);
  });
  it("reconciles cleared rather than pending amounts and keeps inputs immutable", () => {
    const before = fixture();
    let s = apply(before, { type: "transaction", transaction: { id: "pending", accountId: "bank", date: "2026-11-10", amount: -1000, kind: "expense", payee: "Pending", cleared: false } });
    s = apply(s, { type: "reconcile", accountId: "bank", date: "2026-11-10", statedBalance: 99900, adjustmentId: "adjust", reason: "Bank statement difference" });
    expect(accountBalance(s, "bank", true)).toBe(99900);
    expect(accountBalance(s, "bank")).toBe(98900);
    expect(before.transactions).toHaveLength(0);
  });
  it("updates card reserves after recategorization, refund and void", () => {
    let s = apply(fixture(), { type: "allocate", categoryId: "food", month: "2026-11", amount: 10000 });
    s = apply(s, { type: "transaction", transaction: { id: "meal", accountId: "card", date: "2026-11-10", amount: -4000, kind: "expense", payee: "Meal", splits: [{ categoryId: "food", amount: 4000 }] } });
    expect(s.cardPayments.card).toBe(4000);
    s = apply(s, { type: "categorize", id: "meal", splits: [] });
    expect(s.cardPayments.card).toBe(0);
    s = apply(s, { type: "categorize", id: "meal", splits: [{ categoryId: "food", amount: 4000 }] });
    expect(s.cardPayments.card).toBe(4000);
    s = apply(s, { type: "transaction", transaction: { id: "refund", accountId: "card", date: "2026-11-10", amount: 1000, kind: "refund", payee: "Refund", splits: [{ categoryId: "food", amount: 1000 }] } });
    expect(s.cardPayments.card).toBe(3000);
    s = apply(s, { type: "voidTransaction", id: "refund", reason: "Refund was not received" });
    expect(s.cardPayments.card).toBe(4000);
    s = apply(s, { type: "voidTransaction", id: "meal", reason: "Duplicate" });
    expect(s.cardPayments.card).toBe(0);
  });
  it("does not fund today's plan with future income", () => {
    const s = apply(fixture(), { type: "transaction", transaction: { id: "future", accountId: "bank", date: "2099-01-01", amount: 100000, kind: "income", payee: "Forecast" } });
    expect(financeSummary(s)[0].cash).toBe(100000);
  });
  it("does not allocate uncleared incoming funds but reserves pending spending", () => {
    let s = apply(fixture(), { type: "transaction", transaction: { id: "pending-income", accountId: "bank", date: "2026-11-10", amount: 10000, kind: "income", payee: "Pending", cleared: false } });
    s = apply(s, { type: "transaction", transaction: { id: "pending-cost", accountId: "bank", date: "2026-11-10", amount: -2000, kind: "expense", payee: "Pending", cleared: false } });
    expect(financeSummary(s)[0].cash).toBe(98000);
    expect(accountBalance(s, "bank")).toBe(108000);
  });
  it("corrects both transfer legs and its fee atomically", () => {
    let s = apply(fixture(), { type: "account", account: { id: "other", name: "Other", kind: "bank", currency: "USD", openingBalance: 0 } });
    s = apply(s, { type: "transfer", id: "transfer", from: "bank", to: "other", date: "2026-11-10", sourceAmount: 1000, destinationAmount: 1000, fee: 100 });
    expect(() => apply(s, { type: "voidTransaction", id: "transfer:out", reason: "Wrong transfer" })).toThrow();
    s = apply(s, { type: "voidTransfer", id: "transfer", reason: "Wrong transfer" });
    expect(accountBalance(s, "bank")).toBe(100000);
    expect(accountBalance(s, "other")).toBe(0);
    expect(s.transactions.every(t => t.voided)).toBe(true);
  });
  it("links reimbursable spending without treating a receipt as income or double spending", () => {
    let s = apply(fixture(), { type: "transaction", transaction: { id: "shared", accountId: "bank", date: "2026-11-10", amount: -6000, kind: "expense", payee: "Shared dinner" } });
    s = apply(s, { type: "linkSharedExpense", id: "shared", sharedExpenseId: "expense-id", reimbursableAmount: 4000, splits: [{ categoryId: "food", amount: 2000 }] });
    s = apply(s, { type: "transaction", transaction: { id: "receipt", accountId: "bank", date: "2026-11-10", amount: 2000, kind: "income", payee: "Bo" } });
    s = apply(s, { type: "classifyReimbursement", id: "receipt", sharedRepaymentId: "payment-id", originalTransactionId: "shared" });
    expect(s.transactions.find(t => t.id === "receipt")?.kind).toBe("reimbursement");
    expect(categoryAvailable(s, "food")).toBe(-2000);
    expect(financeSummary(s)[0].receivable).toBe(2000);
    expect(accountBalance(s, "bank")).toBe(96000);
    expect(() => apply(s, { type: "transaction", transaction: { id: "duplicate", accountId: "bank", date: "2026-11-10", amount: 2000, kind: "reimbursement", payee: "Bo", sharedRepaymentId: "payment-id", originalTransactionId: "shared" } })).toThrow(/already linked/);
  });
  it("does not release another card expense's funding when refund and void overlap", () => {
    let s = apply(fixture(), { type: "allocate", categoryId: "food", month: "2026-11", amount: 10000 });
    for (const id of ["first", "second"]) s = apply(s, { type: "transaction", transaction: { id, accountId: "card", date: "2026-11-10", amount: -4000, kind: "expense", payee: id, splits: [{ categoryId: "food", amount: 4000 }] } });
    s = apply(s, { type: "transaction", transaction: { id: "refund", originalTransactionId: "first", accountId: "card", date: "2026-11-10", amount: 2000, kind: "refund", payee: "Refund", splits: [{ categoryId: "food", amount: 2000 }] } });
    s = apply(s, { type: "voidTransaction", id: "first", reason: "Incorrect purchase" });
    expect(s.cardPayments.card).toBe(2000); // Remaining liability includes the retained refund.
    s = apply(s, { type: "voidTransaction", id: "refund", reason: "Incorrect refund" });
    expect(s.cardPayments.card).toBe(4000);
  });
  it("restores card payment reserves when a whole payment is reversed", () => {
    let s = apply(fixture(), { type: "allocate", categoryId: "food", month: "2026-11", amount: 10000 });
    s = apply(s, { type: "transaction", transaction: { id: "meal", accountId: "card", date: "2026-11-10", amount: -4000, kind: "expense", payee: "Meal", splits: [{ categoryId: "food", amount: 4000 }] } });
    s = apply(s, { type: "transfer", id: "payment", from: "bank", to: "card", sourceAmount: 4000, destinationAmount: 4000, date: "2026-11-10" });
    s = apply(s, { type: "categorize", id: "meal", splits: [{ categoryId: "food", amount: 4000 }] });
    expect(s.cardPayments.card).toBe(0);
    s = apply(s, { type: "voidTransfer", id: "payment", reason: "Payment was reversed" });
    expect(s.cardPayments.card).toBe(4000);
    expect(accountBalance(s, "card")).toBe(-4000);
  });
});
