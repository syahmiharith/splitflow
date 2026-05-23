import { describe, expect, it } from "vitest";
import { calculateItemizedSplit, generateSettlementInstructions } from "@/lib/domain/itemized-split-engine";
import type { ItemizedSplitResult } from "@/lib/domain/itemized-split-engine";

const participants = [
  { id: "syahmi", name: "Syahmi" },
  { id: "ali", name: "Ali" },
  { id: "sarah", name: "Sarah" },
  { id: "daniel", name: "Daniel" }
];

function expectReconciled(result: ItemizedSplitResult) {
  const paidTotal = Object.values(result.totalPaidByParticipant).reduce((sum, amount) => sum + amount, 0);
  const fairShareTotal = Object.values(result.fairShareByParticipant).reduce((sum, amount) => sum + amount, 0);
  const netTotal = Object.values(result.netBalanceByParticipant).reduce((sum, amount) => sum + amount, 0);
  const debtorTotal = result.settlementInstructions.reduce((sum, instruction) => sum + instruction.amount, 0);
  const creditorTotal = Object.values(result.netBalanceByParticipant).filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);

  expect(paidTotal).toBe(result.totalCost);
  expect(fairShareTotal).toBe(result.totalCost);
  expect(netTotal).toBe(0);
  expect(debtorTotal).toBe(creditorTotal);
  expect(result.validationWarnings).toEqual([]);
}

describe("itemized split engine", () => {
  it("calculates a simple equal split", () => {
    const result = calculateItemizedSplit({
      currency: "KRW",
      participants: participants.slice(0, 2),
      items: [{ id: "dinner", label: "Dinner", amount: 10000, paidByParticipantId: "syahmi" }]
    });

    expect(result.totalCost).toBe(10000);
    expect(result.fairShareByParticipant).toMatchObject({ syahmi: 5000, ali: 5000 });
    expect(result.netBalanceByParticipant).toMatchObject({ syahmi: 5000, ali: -5000 });
    expect(result.settlementInstructions[0].text).toBe("Ali pays Syahmi ₩5,000");
    expectReconciled(result);
  });

  it("supports multiple payers", () => {
    const result = calculateItemizedSplit({
      currency: "KRW",
      participants: participants.slice(0, 2),
      items: [
        { id: "food", label: "Food", amount: 10000, paidByParticipantId: "syahmi" },
        { id: "drinks", label: "Drinks", amount: 4000, paidByParticipantId: "ali" }
      ]
    });

    expect(result.totalPaidByParticipant).toMatchObject({ syahmi: 10000, ali: 4000 });
    expect(result.fairShareByParticipant).toMatchObject({ syahmi: 7000, ali: 7000 });
    expect(result.netBalanceByParticipant).toMatchObject({ syahmi: 3000, ali: -3000 });
    expectReconciled(result);
  });

  it("excludes one participant from one item", () => {
    const result = calculateItemizedSplit({
      currency: "KRW",
      participants,
      items: [{ id: "meat", label: "Meat", amount: 9000, paidByParticipantId: "syahmi", excludedParticipantIds: ["daniel"] }]
    });

    expect(result.fairShareByParticipant.daniel).toBe(0);
    expect(result.fairShareByParticipant.sarah).toBe(3000);
    expect(result.itemizedBreakdown[0].auditText).toContain("Daniel excluded");
    expect(result.itemizedBreakdown[0].shareByParticipant.daniel).toBeUndefined();
    expectReconciled(result);
  });

  it("identifies a participant who paid more than their fair share", () => {
    const result = calculateItemizedSplit({
      currency: "KRW",
      participants: participants.slice(0, 3),
      items: [{ id: "bill", label: "Bill", amount: 12000, paidByParticipantId: "sarah" }]
    });

    expect(result.netBalanceByParticipant.sarah).toBe(8000);
  });

  it("documents rounding mismatch assignments while reconciling", () => {
    const result = calculateItemizedSplit({
      currency: "KRW",
      participants: participants.slice(0, 3),
      items: [{ id: "snack", label: "Snack", amount: 10000, paidByParticipantId: "syahmi" }]
    });

    expect(Object.values(result.fairShareByParticipant).reduce((sum, amount) => sum + amount, 0)).toBe(10000);
    expect(result.roundingAdjustments).toHaveLength(1);
    expect(result.validationWarnings).toEqual([]);
    expectReconciled(result);
  });

  it("rejects an invalid item with no eligible participants", () => {
    expect(() =>
      calculateItemizedSplit({
        currency: "KRW",
        participants: participants.slice(0, 1),
        items: [{ id: "private", label: "Private", amount: 1000, paidByParticipantId: "syahmi", excludedParticipantIds: ["syahmi"] }]
      })
    ).toThrow("no eligible participants");
  });

  it("calculates a custom trip lodging example", () => {
    const tripParticipants = [
      { id: "syahmi", name: "Syahmi" },
      { id: "ali", name: "Ali" },
      { id: "sarah", name: "Sarah" },
      { id: "alex", name: "Alex" },
      { id: "aiman", name: "Aiman" },
      { id: "amir", name: "Amir" },
      { id: "aisyah", name: "Aisyah" },
      { id: "mina", name: "Mina" }
    ];
    const result = calculateItemizedSplit({
      currency: "KRW",
      participants: tripParticipants,
      items: [
        { id: "friday-airbnb", label: "Friday Airbnb", amount: 220000, paidByParticipantId: "syahmi", excludedParticipantIds: ["alex"] },
        { id: "saturday-airbnb", label: "Saturday Airbnb", amount: 260000, paidByParticipantId: "ali" },
        { id: "van-rental", label: "Van rental", amount: 90000, paidByParticipantId: "sarah" }
      ]
    });

    expect(result.totalCost).toBe(570000);
    expect(Object.values(result.totalPaidByParticipant).reduce((sum, amount) => sum + amount, 0)).toBe(570000);
    expect(Object.values(result.fairShareByParticipant).reduce((sum, amount) => sum + amount, 0)).toBe(570000);
    expect(Object.values(result.netBalanceByParticipant).reduce((sum, amount) => sum + amount, 0)).toBe(0);
    expect(result.fairShareByParticipant.alex).toBeLessThan(result.fairShareByParticipant.aiman);
    expect(result.itemizedBreakdown.find((item) => item.itemId === "friday-airbnb")?.shareByParticipant.alex).toBeUndefined();
    expect(result.settlementInstructions.length).toBeGreaterThan(0);
    expectReconciled(result);
  });
});

describe("settlement instructions", () => {
  it("minimizes debtor to creditor payments", () => {
    const instructions = generateSettlementInstructions(participants.slice(0, 3), {
      syahmi: 7000,
      ali: -3000,
      sarah: -4000
    });

    expect(instructions.map((instruction) => instruction.text)).toEqual(["Ali pays Syahmi ₩3,000", "Sarah pays Syahmi ₩4,000"]);
  });
});
