import { describe, expect, it } from "vitest";
import { stableArtifactKey, stableProposalIdFromDraft } from "@/lib/artifact-identity";
import { parseExpensePrompt } from "@/lib/parser/expense-parser";

const bbqPrompt = `I'm organizing a Han River BBQ for 8 people and need agreement before I front ₩128,000.

Estimated costs:
- meat ₩80,000
- drinks ₩20,000
- charcoal ₩10,000
- sides ₩18,000

Daniel does not eat beef, so exclude him from meat.
Sarah already sent me ₩10,000, but I need to confirm it before counting it as paid.
Ali says he may request a change if his share goes above ₩20,000.`;

describe("artifact and proposal identity", () => {
  it("creates stable artifact keys for the same normalized source", () => {
    const first = stableArtifactKey({
      groupId: "han-river-bbq",
      chatId: "chat-han-river-bbq",
      proposalId: "han-river-bbq-proposal",
      type: "proposal_draft",
      sourceText: bbqPrompt
    });
    const second = stableArtifactKey({
      groupId: "han-river-bbq",
      chatId: "chat-han-river-bbq",
      proposalId: "han-river-bbq-proposal",
      type: "proposal_draft",
      sourceText: `  ${bbqPrompt.toUpperCase()}  `
    });

    expect(second).toEqual(first);
  });

  it("keeps canonical BBQ proposal ids deterministic", () => {
    const parsed = parseExpensePrompt(bbqPrompt);
    expect(parsed.draft).toBeDefined();
    expect(stableProposalIdFromDraft(parsed.draft!, "han-river-bbq")).toBe("han-river-bbq-proposal");
  });

  it("keeps the legacy bbq-dinner canonical id working", () => {
    const parsed = parseExpensePrompt("BBQ dinner for Syahmi, Ali, and Sarah. Total ₩30,000 paid by Syahmi.");
    expect(parsed.draft).toBeDefined();
    expect(stableProposalIdFromDraft(parsed.draft!, "han-river-bbq")).toBe("bbq-dinner");
  });
});
