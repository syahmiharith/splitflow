import type { Proposal } from "@/lib/types";
import { deriveSplitReadiness } from "@/lib/readiness";

export type ProposalFilter =
  | "active"
  | "draft"
  | "sent"
  | "paid"
  | "needs_action"
  | "drafts"
  | "waiting_responses"
  | "changes_requested"
  | "ready_to_settle"
  | "settled"
  | "all";

export function matchesProposalFilter(proposal: Proposal, filter: ProposalFilter): boolean {
  if (proposal.status === "archived") return false;

  const readiness = deriveSplitReadiness(proposal);
  if (filter === "active") return ["draft", "sent", "waiting_for_responses", "changes_requested", "recalculation_needed", "needs_reconfirmation"].includes(proposal.status);
  if (filter === "draft") return proposal.status === "draft";
  if (filter === "sent") return ["sent", "waiting_for_responses"].includes(proposal.status);
  if (filter === "paid") return readiness.state === "settled";
  if (filter === "drafts") return proposal.status === "draft";
  if (filter === "waiting_responses") return ["sent", "waiting_for_responses"].includes(proposal.status);
  if (filter === "changes_requested") {
    return proposal.status === "changes_requested" || proposal.participants.some((participant) => participant.status === "requested_changes");
  }
  if (filter === "ready_to_settle") return readiness.state === "ready";
  if (filter === "settled") return readiness.state === "settled";
  if (filter === "needs_action") {
    if (readiness.state === "settled" || proposal.status === "settled") return false;
    return (
      ["changes_requested", "recalculation_needed", "needs_reconfirmation"].includes(proposal.status) ||
      readiness.claimedPayments > 0 ||
      readiness.changeRequests > 0 ||
      readiness.responseProgress.confirmed < readiness.responseProgress.total
    );
  }
  return true;
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
