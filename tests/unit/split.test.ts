import { describe, expect, it } from "vitest";
import { demoProposal } from "@/lib/demo-data";
import {
  applyOptOut,
  calculateCustomSplit,
  calculateEqualSplit,
  calculateUnitSplit,
  isSafeToBook,
  organizerRisk,
  validateCustomSplit
} from "@/lib/split";
import type { Participant, Proposal } from "@/lib/types";

const participants: Participant[] = [
  { id: "a", name: "A", status: "pending", paymentStatus: "unpaid", shareAmount: 0, units: 2, customAmount: 90000 },
  { id: "b", name: "B", status: "pending", paymentStatus: "unpaid", shareAmount: 0, units: 1, customAmount: 60000 },
  { id: "c", name: "C", status: "pending", paymentStatus: "unpaid", shareAmount: 0, units: 1, customAmount: 30000 }
];

describe("split calculations", () => {
  it("calculates equal split", () => {
    const result = calculateEqualSplit(120000, participants);
    expect(result.map((participant) => participant.shareAmount)).toEqual([40000, 40000, 40000]);
  });

  it("validates custom split totals", () => {
    expect(validateCustomSplit(180000, participants)).toBe(true);
    expect(validateCustomSplit(179999, participants)).toBe(false);
  });

  it("calculates custom split when totals match", () => {
    const result = calculateCustomSplit(180000, participants);
    expect(result.map((participant) => participant.shareAmount)).toEqual([90000, 60000, 30000]);
  });

  it("calculates unit-based split", () => {
    const result = calculateUnitSplit(120000, participants);
    expect(result.map((participant) => participant.shareAmount)).toEqual([60000, 30000, 30000]);
  });

  it("recalculates after opt-out and requires reconfirmation", () => {
    const proposal: Proposal = {
      ...demoProposal,
      splitMethod: "equal",
      totalCost: 120000,
      participants: participants.map((participant) => ({ ...participant, status: "accepted" }))
    };
    const result = applyOptOut(proposal, "c");
    expect(result.status).toBe("needs_reconfirmation");
    expect(result.participants.find((participant) => participant.id === "c")?.shareAmount).toBe(0);
    expect(result.participants.find((participant) => participant.id === "a")?.status).toBe("needs_reconfirmation");
  });

  it("calculates organizer risk", () => {
    const proposal: Proposal = {
      ...demoProposal,
      totalCost: 100000,
      participants: [
        { id: "a", name: "A", status: "accepted", paymentStatus: "unpaid", shareAmount: 50000 },
        { id: "b", name: "B", status: "pending", paymentStatus: "unpaid", shareAmount: 50000 }
      ]
    };
    expect(organizerRisk(proposal)).toBe(50000);
  });

  it("marks proposal safe only when everyone accepted and risk is zero", () => {
    const proposal: Proposal = {
      ...demoProposal,
      totalCost: 100000,
      participants: [
        { id: "a", name: "A", status: "accepted", paymentStatus: "unpaid", shareAmount: 50000 },
        { id: "b", name: "B", status: "accepted", paymentStatus: "unpaid", shareAmount: 50000 }
      ]
    };
    expect(isSafeToBook(proposal)).toBe(true);
  });
});
