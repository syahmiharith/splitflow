import { describe, expect, it } from "vitest";
import { parseExpensePrompt } from "@/lib/parser/expense-parser";
import { createProposalFromPrompt } from "@/lib/prototype-proposals";

describe("prototype-grade expense parser", () => {
  it("parses itemized dinner costs with Daniel beef exclusion", () => {
    const result = parseExpensePrompt(
      "Dinner for 8 people. I paid 128,000 won. Meat was 80k, drinks 20k, dessert 10k, sides 18k. Daniel doesn't eat beef so don't charge him for meat."
    );

    expect(result.status).toBe("ready");
    expect(result.confidence).toBe("medium");
    expect(result.draft?.items.map((item) => [item.label, item.amount])).toEqual([
      ["Meat", 80000],
      ["Drinks", 20000],
      ["Dessert", 10000],
      ["Sides", 18000]
    ]);
    expect(result.draft?.participants).toHaveLength(8);
    expect(result.draft?.items.find((item) => item.id === "meat")?.excludedParticipantNames).toContain("Daniel");
  });

  it("creates a total-only equal split", () => {
    const { proposal, parserResult } = createProposalFromPrompt("Split 100,000 won between 5 people", "test-group");

    expect(parserResult.status).toBe("ready");
    expect(proposal?.costItems).toHaveLength(1);
    expect(proposal?.calculationResult?.totalCost).toBe(100000);
    expect(proposal?.participants).toHaveLength(5);
  });

  it("parses itemized dinner with one exclusion and generated participants", () => {
    const { proposal, parserResult } = createProposalFromPrompt("Dinner was 90k, drinks 30k, Daniel no drinks, 5 people", "test-group");

    expect(parserResult.status).toBe("ready");
    expect(parserResult.draft?.assumptions).toContain("Some participant names were generated because only the count was provided.");
    const drinks = proposal?.calculationResult?.itemizedBreakdown.find((item) => item.label === "Drinks");
    expect(drinks?.eligibleParticipantIds).not.toContain("daniel");
  });

  it("does not treat proposal commands or prior-payment notes as participants or cost items", () => {
    const { proposal, parserResult } = createProposalFromPrompt(
      "I'm organizing a live production smoke test dinner split for 5 people. I paid ₩90,000 food, Ali paid ₩30,000 drinks, Sarah already sent me ₩10,000 that needs confirmation, and Daniel does not drink alcohol. Create a proposal I can review before collecting.",
      "test-group"
    );

    expect(parserResult.status).toBe("ready");
    expect(parserResult.draft?.participants.map((participant) => participant.name)).not.toContain("Create");
    expect(parserResult.draft?.items.map((item) => item.label)).toEqual(["Food", "Drinks"]);
    expect(proposal?.calculationResult?.totalCost).toBe(120000);
    expect(proposal?.paymentRecords?.[0]).toMatchObject({ fromParticipantId: "sarah", amount: 10000, status: "claimed" });
    expect(proposal?.calculationResult?.itemizedBreakdown.find((item) => item.label === "Drinks")?.eligibleParticipantIds).not.toContain("daniel");
  });

  it("handles multiple payers for a group gift", () => {
    const { proposal, parserResult } = createProposalFromPrompt(
      "We bought a group gift for Minji. Total was 150k. Split between 6 people, but Adam paid 50k upfront and I paid the rest.",
      "gift-group"
    );

    expect(parserResult.status).toBe("ready");
    expect(proposal?.participants).toHaveLength(6);
    expect(proposal?.participants.some((participant) => participant.name === "Minji")).toBe(false);
    expect(proposal?.calculationResult?.totalPaidByParticipant.adam).toBe(50000);
    expect(proposal?.calculationResult?.totalPaidByParticipant.you).toBe(100000);
  });

  it("creates claimed prior payment credit records without applying them as confirmed proof", () => {
    const { proposal, parserResult } = createProposalFromPrompt(
      "Movie night: I paid 72,000 for tickets and 24,000 for snacks. Daniel skipped snacks. Sarah already paid me 10,000.",
      "movie-group"
    );

    expect(parserResult.status).toBe("ready");
    expect(proposal?.credits?.[0]).toMatchObject({ fromParticipantId: "sarah", toParticipantId: "you", amount: 10000 });
    expect(proposal?.paymentRecords?.[0]).toMatchObject({ fromParticipantId: "sarah", toParticipantId: "you", amount: 10000, status: "claimed" });
    expect(proposal?.parserWarnings?.join(" ")).toContain("claimed");
  });

  it("parses named participants", () => {
    const result = parseExpensePrompt("Dinner was 120k for Ali, Daniel, Sarah, Mira and me");

    expect(result.status).toBe("ready");
    expect(result.draft?.participants.map((participant) => participant.name)).toEqual(["Organizer", "Ali", "Daniel", "Mira", "Sarah"]);
  });

  it("asks clarification for mismatched stated total and items", () => {
    const result = parseExpensePrompt("Dinner for 8 people. Total was 128,000 won. Meat was 80k and drinks 20k.");

    expect(result.status).toBe("needs_clarification");
    expect(result.clarificationQuestions[0].question).toContain("itemized costs add up");
  });

  it("asks clarification for ambiguous item amount mapping", () => {
    const result = parseExpensePrompt(
      "Trip dinner. Ali paid 95,000 KRW for chicken, rice, drinks and dessert. 5 people joined but Mira only had drinks."
    );

    expect(result.status).toBe("needs_clarification");
    expect(result.clarificationQuestions.map((question) => question.question).join(" ")).toMatch(/drinks|item/i);
  });

  it("returns unsupported for vague input without money", () => {
    const result = parseExpensePrompt("Can you split this fairly for some people?");

    expect(result.status).toBe("unsupported");
    expect(result.confidence).toBe("low");
  });

  it("normalizes KRW, won, comma, and k formats", () => {
    const prompts = ["Split ₩128,000 between 4 people", "Split 128,000 won between 4 people", "Split 128k KRW between 4 people", "Split 20k won between 4 people"];
    const totals = prompts.map((prompt) => parseExpensePrompt(prompt).draft?.statedTotal);

    expect(totals).toEqual([128000, 128000, 128000, 20000]);
  });

  it("keeps deterministic split reconciliation intact", () => {
    const { proposal } = createProposalFromPrompt(
      "House dinner yesterday. Groceries 64,500, delivery 3,000, drinks 18,000. 4 people. Hakim doesn't drink. Round to nearest won.",
      "house-group"
    );
    const calculation = proposal?.calculationResult;

    expect(calculation?.totalCost).toBe(85500);
    expect(Object.values(calculation?.fairShareByParticipant ?? {}).reduce((sum, amount) => sum + amount, 0)).toBe(calculation?.totalCost);
    expect(Object.values(calculation?.netBalanceByParticipant ?? {}).reduce((sum, amount) => sum + amount, 0)).toBe(0);
  });
});
