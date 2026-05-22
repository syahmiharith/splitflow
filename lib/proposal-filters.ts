import type { Proposal } from "@/lib/types";

export type ProposalFilter = "active" | "draft" | "sent" | "paid";

export function matchesProposalFilter(proposal: Proposal, filter: ProposalFilter): boolean {
  if (filter === "draft") return proposal.status === "draft";
  if (filter === "sent") return ["sent", "waiting_for_responses", "changes_requested", "recalculation_needed", "needs_reconfirmation", "safe_to_book"].includes(proposal.status);
  if (filter === "paid") return ["partially_paid", "settled"].includes(proposal.status);
  return !["settled", "archived"].includes(proposal.status);
}

export function matchesProposalSearch(proposal: Proposal, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    proposal.title,
    proposal.status,
    proposal.recommendation,
    ...proposal.participants.map((participant) => participant.name),
    ...proposal.costItems.map((item) => item.label)
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function filterProposals(proposals: Proposal[], filter: ProposalFilter, query: string): Proposal[] {
  return proposals.filter((proposal) => matchesProposalFilter(proposal, filter)).filter((proposal) => matchesProposalSearch(proposal, query));
}
