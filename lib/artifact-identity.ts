import type { Artifact, ArtifactBundleSection, Proposal } from "@/lib/types";
import type { ParsedExpenseDraft } from "@/lib/parser/expense-types";

export function normalizeIdentityText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[[^\]]*image attachment[^\]]*\]/g, "")
    .replace(/[^a-z0-9₩]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function slugIdentity(value: string | undefined, fallback = "artifact"): string {
  const slug = normalizeIdentityText(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || fallback;
}

export function stableArtifactKey(input: {
  groupId: string;
  chatId: string;
  proposalId?: string;
  type: Artifact["type"];
  sourceText?: string;
}): { stableKey: string; sourceHash: string } {
  const normalizedSource = normalizeIdentityText(input.sourceText ?? input.proposalId ?? input.type);
  const sourceHash = stableHash(normalizedSource);
  return {
    stableKey: [input.groupId, input.chatId, input.proposalId ?? "no-proposal", input.type, sourceHash].join(":"),
    sourceHash
  };
}

export function stableProposalIdFromDraft(draft: ParsedExpenseDraft, groupId = "han-river-bbq"): string {
  const titleSlug = slugIdentity(draft.title, "split");
  const source = normalizeIdentityText(draft.rawInput);
  if (titleSlug === "bbq-dinner" || source.includes("bbq dinner")) return "bbq-dinner";
  if (source.includes("han river bbq") || titleSlug.includes("han-river-bbq")) return "han-river-bbq-proposal";

  const participantSignature = draft.participants.map((participant) => slugIdentity(participant.name, "participant")).sort().join(",");
  const itemSignature = draft.items
    .map((item) => `${slugIdentity(item.label, "item")}:${item.amount ?? "unknown"}`)
    .sort()
    .join(",");
  const ruleSignature = [
    ...draft.exclusions.map((rule) => `${slugIdentity(rule.participantName)}:${slugIdentity(rule.itemLabel ?? rule.onlyIncludedItemLabel ?? "all")}`),
    ...draft.credits.map((credit) => `${slugIdentity(credit.fromName)}:${credit.amount}`)
  ]
    .sort()
    .join(",");
  const signature = normalizeIdentityText([groupId, draft.title, draft.statedTotal ?? "", participantSignature, itemSignature, ruleSignature, draft.rawInput].join("|"));
  return `proposal-${titleSlug}-${stableHash(signature)}`;
}

export function buildProposalArtifactSections(proposal: Proposal, parserDetails: string[] = []): ArtifactBundleSection[] {
  const auditCount = proposal.calculationResult?.auditExplanation.length ?? 0;
  const settlementCount = proposal.calculationResult?.settlementInstructions.length ?? 0;
  const ledgerCount = proposal.paymentRecords?.length ?? 0;
  const warningCount = (proposal.parserWarnings?.length ?? 0) + (proposal.parserAssumptions?.length ?? 0);
  return [
    { id: "review", label: "Review", available: true, count: parserDetails.length, summary: "Parsed costs, people, payers, and rules." },
    { id: "math", label: "Math", available: auditCount > 0, count: auditCount, summary: "Deterministic itemized split audit." },
    { id: "settlement", label: "Settlement", available: settlementCount > 0, count: settlementCount, summary: "Who should pay whom after netting." },
    { id: "ledger", label: "Ledger", available: ledgerCount > 0, count: ledgerCount, summary: "Claimed or confirmed payment records." },
    { id: "warnings", label: "Warnings", available: warningCount > 0, count: warningCount, summary: "Assumptions and risk notes for review." }
  ];
}
