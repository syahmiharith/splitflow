import { describe, expect, it } from "vitest";
import { parseExpensePrompt } from "@/lib/parser/expense-parser";
import {
  createProposalFromPrompt,
  createProposalFromPromptWithAllocation,
  createSettlementLedgerLines,
  updatePaymentRecordStatus
} from "@/lib/prototype-proposals";

describe("allocation and proof-aware credit mitigation", () => {
  it("classifies pasted receipt-like text and creates deterministic items", () => {
    const input = `Jeju Crew
Friday stay 180,000
Saturday stay 260,000
Van rental 90,000
Total 530,000
7 people
Alex no Friday`;

    const { proposal, parserResult } = createProposalFromPrompt(input, "han-river-bbq");

    expect(parserResult.status).toBe("ready");
    expect(parserResult.mode).toBe("receipt_text");
    expect(proposal?.calculationResult?.totalCost).toBe(530000);
    expect(proposal?.calculationResult?.itemizedBreakdown.find((item) => item.itemId === "friday-stay")?.eligibleParticipantIds).not.toContain("alex");
  });

  it("requires allocation resolution for grouped items with item-level exclusion", () => {
    const result = parseExpensePrompt("Dinner and drinks were 120k for 5 people. Daniel did not drink.");

    expect(result.status).toBe("needs_clarification");
    expect(result.issues.some((issue) => issue.code === "allocation_required")).toBe(true);
    expect(result.clarificationQuestions[0].question).toContain("split the total equally between items");
  });

  it("uses deterministic equal allocation when organizer chooses it", () => {
    const { proposal } = createProposalFromPromptWithAllocation(
      "Dinner and drinks were 120k for 5 people. Daniel did not drink.",
      "dinner-group",
      "single_total_equal_items"
    );

    expect(proposal?.costItems.map((item) => item.amount)).toEqual([60000, 60000]);
    expect(proposal?.calculationResult?.totalCost).toBe(120000);
    expect(proposal?.calculationResult?.itemizedBreakdown.find((item) => item.label === "Drinks")?.eligibleParticipantIds).not.toContain("daniel");
  });

  it("allocates a single missing item from remainder", () => {
    const { proposal, parserResult } = createProposalFromPrompt(
      "Food 80k, drinks included in total 100k. Daniel no drinks. 5 people.",
      "food-group"
    );

    expect(parserResult.status).toBe("ready");
    expect(parserResult.draft?.assumptions.join(" ")).toContain("Allocated remaining ₩20,000 to Drinks");
    expect(proposal?.costItems.find((item) => item.label === "Drinks")?.amount).toBe(20000);
  });

  it("confirmed credits reduce settlement, disputed and void credits do not", () => {
    const { proposal } = createProposalFromPrompt(
      "Movie night: I paid 72,000 for tickets and 24,000 for snacks. Daniel skipped snacks. Sarah already paid me 10,000.",
      "movie-group"
    );
    expect(proposal?.paymentRecords?.[0].status).toBe("claimed");
    const claimedSarahNet = proposal?.calculationResult?.netBalanceByParticipant.sarah;

    const confirmed = updatePaymentRecordStatus(proposal!, proposal!.paymentRecords![0].id, "confirmed");
    expect(confirmed.calculationResult?.netBalanceByParticipant.sarah).toBe((claimedSarahNet ?? 0) + 10000);
    expect(createSettlementLedgerLines(confirmed).join(" ")).toContain("confirmed paid ₩10,000");

    const disputed = updatePaymentRecordStatus(proposal!, proposal!.paymentRecords![0].id, "disputed");
    expect(disputed.calculationResult?.netBalanceByParticipant.sarah).toBe(claimedSarahNet);

    const voided = updatePaymentRecordStatus(proposal!, proposal!.paymentRecords![0].id, "void");
    expect(voided.calculationResult?.netBalanceByParticipant.sarah).toBe(claimedSarahNet);
  });
});
