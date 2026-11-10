import { describe, expect, it } from "vitest";
import { applyCommand, balances, claimedBalances, claimState, settlements, type Split } from "@/lib/pilot/model";
const owner = "alex@example.test", other = "bo@example.test";
function claim(amount = 1000): Split {
  return {
    id: crypto.randomUUID(), organizer: owner, revision: 1,
    expense: { title: "Dinner", mode: "paid", participants: [
      { name: "Alex", email: owner, paid: amount }, { name: "Bo", email: other, paid: 0 },
    ], items: [{ name: "Dinner", amount, included: [owner, other] }] },
    responses: {}, repayments: [], audit: [],
  };
}
const accept = (s: Split) => applyCommand(s, other, { type: "respond", status: "accepted", reason: "" });
const revise = (s: Split, amount: number) => applyCommand(s, owner, {
  type: "revise", expense: claim(amount).expense, reason: "Corrected claim",
});

describe("expense claims require consent", () => {
  it("does not turn a unilateral inflated or fabricated claim into an agreed debt", () => {
    for (const amount of [1000, 10000]) {
      const s = claim(amount);
      expect(claimState(s)).toBe("pending");
      expect(claimedBalances(s)[other]).toBe(amount / 2);
      expect(balances(s)).toEqual({ [owner]: 0, [other]: 0 });
      expect(settlements(s)).toEqual([]);
    }
  });
  it("retains denied claims and reasons without deciding factual truth", () => {
    const s = applyCommand(claim(), other, { type: "respond", status: "declined", reason: "I was not there" });
    expect(claimState(s)).toBe("disputed");
    expect(s.expense.items[0].amount).toBe(1000);
    expect(s.responses[other].status).toBe("declined");
    expect(s.responseHistory?.[0].reason).toBe("I was not there");
    expect(balances(s)[other]).toBe(0);
    const accepted = accept(s);
    expect(accepted.responseHistory?.map(r => r.status)).toEqual(["declined", "accepted"]);
    expect(balances(accepted)[other]).toBe(500);
  });
  it("requires a reason for disagreeing and prevents another actor responding for someone", () => {
    expect(() => applyCommand(claim(), other, { type: "respond", status: "declined", reason: "" })).toThrow();
    expect(() => applyCommand(claim(), "stranger@example.test", { type: "respond", status: "accepted", reason: "" })).toThrow();
    const own = applyCommand(claim(), owner, { type: "respond", status: "accepted", reason: "" });
    expect(claimState(own)).toBe("pending");
  });
  it("does not let a revision inflate or erase an already agreed balance", () => {
    const agreed = accept(claim());
    const increased = revise(agreed, 10000);
    expect(claimState(increased)).toBe("pending");
    expect(balances(increased)[other]).toBe(500);
    expect(claimedBalances(increased)[other]).toBe(5000);
    const denied = applyCommand(increased, other, { type: "respond", status: "declined", reason: "Original total was right" });
    expect(balances(denied)[other]).toBe(500);
    expect(balances(accept(increased))[other]).toBe(5000);
  });
  it("preserves a previously agreed debt when a participant later disputes it", () => {
    const s = applyCommand(accept(claim()), other, { type: "respond", status: "declined", reason: "I disagree now" });
    expect(claimState(s)).toBe("disputed");
    expect(balances(s)[other]).toBe(500);
    expect(s.agreement?.expense.items[0].amount).toBe(1000);
  });
  it("preserves confirmed transfers across revised claims and exposes agreed overpayment", () => {
    const reported = applyCommand(accept(claim()), other, { type: "report", to: owner, amount: 500 });
    const received = applyCommand(reported, owner, { type: "receipt", paymentId: reported.repayments[0].id, status: "confirmed" });
    const updated = revise(received, 600);
    expect(balances(updated)[other]).toBe(0);
    const agreed = accept(updated);
    expect(balances(agreed)[other]).toBe(-200);
    expect(agreed.repayments).toEqual(received.repayments);
  });
  it("retains real transfers even before a claim is agreed without treating them as acceptance", () => {
    const reported = applyCommand(claim(), other, { type: "report", to: owner, amount: 500 });
    const confirmed = applyCommand(reported, owner, { type: "receipt", paymentId: reported.repayments[0].id, status: "confirmed" });
    expect(claimState(confirmed)).toBe("pending");
    expect(balances(confirmed)[other]).toBe(-500);
  });
  it("preserves legacy stored consent before a revision clears current responses", () => {
    const legacy = claim();
    legacy.responses[other] = { revision: 1, status: "accepted", reason: "Amount checked" };
    const changed = revise(legacy, 10000);
    expect(changed.responses[other]).toBeUndefined();
    expect(changed.responseHistory).toEqual([{ actor: other, revision: 1, status: "accepted", reason: "Amount checked" }]);
    expect(balances(changed)[other]).toBe(500);
  });
  it("does not let an incurred claim become a plan and hide agreed money or transfers", () => {
    const agreed = accept(claim());
    const reported = applyCommand(agreed, other, { type: "report", to: owner, amount: 200 });
    const received = applyCommand(reported, owner, { type: "receipt", paymentId: reported.repayments[0].id, status: "confirmed" });
    for (const current of [claim(), agreed, received]) {
      expect(() => applyCommand(current, owner, {
        type: "revise", expense: { ...current.expense, mode: "planned" }, reason: "Turn into plan",
      })).toThrow(/cannot be changed back to a plan/);
    }
    expect(balances(received)[other]).toBe(300);
    expect(received.agreement?.expense.mode).toBe("paid");
    expect(received.repayments[0].status).toBe("confirmed");
  });
  it("allows planned costs to become paid claims only through fresh consent", () => {
    const proposed = claim(); proposed.expense.mode = "planned";
    const planned = accept(proposed);
    const actual = applyCommand(planned, owner, {
      type: "revise", expense: { ...planned.expense, mode: "paid" }, reason: "Actual cost recorded",
    });
    expect(claimState(actual)).toBe("pending");
    expect(balances(actual)[other]).toBe(0);
    expect(balances(accept(actual))[other]).toBe(500);
  });
  it("does not treat acceptance of a plan as an incurred debt", () => {
    const s = claim(); s.expense.mode = "planned";
    expect(balances(accept(s))[other]).toBe(0);
  });
});
