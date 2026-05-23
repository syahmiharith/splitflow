import { describe, expect, it } from "vitest";
import { defaultGroup } from "@/lib/demo-data";
import { deriveActionQueue, deriveParticipantShareExplanation, deriveReadinessSummary } from "@/lib/readiness";
import { createJejuTripProposal, recalculateProposal } from "@/lib/prototype-proposals";
import type { Proposal } from "@/lib/types";

function withStatuses(statuses: Record<string, Proposal["participants"][number]["status"]>, proposal = createJejuTripProposal()): Proposal {
  return recalculateProposal({
    ...proposal,
    participants: proposal.participants.map((participant) => ({
      ...participant,
      status: statuses[participant.id] ?? participant.status
    }))
  });
}

describe("readiness helpers", () => {
  it("summarizes draft, waiting, change, opt-out, safe, and settled states", () => {
    const draft = createJejuTripProposal();
    expect(deriveReadinessSummary(draft)).toMatchObject({ title: "Review Before Sending", nextAction: "Send Your Share" });

    const waiting = withStatuses({ you: "accepted", mina: "pending", daniel: "accepted", alex: "accepted", sarah: "accepted", yuna: "accepted", josh: "accepted" });
    expect(deriveReadinessSummary({ ...waiting, status: "waiting_for_responses" }).blockers.join(" ")).toContain("Waiting for Mina");

    const changed = withStatuses({ alex: "requested_changes" });
    expect(deriveReadinessSummary({ ...changed, status: "changes_requested" })).toMatchObject({ title: "Not Ready Yet", nextAction: "Resolve changes" });

    const optedOut = withStatuses({ yuna: "opted_out" });
    expect(deriveReadinessSummary({ ...optedOut, status: "recalculation_needed" }).blockers.join(" ")).toContain("opted out");

    const safe = withStatuses({ you: "accepted", mina: "accepted", daniel: "accepted", alex: "accepted", sarah: "accepted", yuna: "accepted", josh: "accepted" });
    expect(deriveReadinessSummary({ ...safe, status: "safe_to_book" })).toMatchObject({ title: "Ready to Book", nextAction: "Book with confidence" });

    expect(deriveReadinessSummary({ ...safe, status: "settled" })).toMatchObject({ title: "Collected" });
  });

  it("explains included and excluded participant share items", () => {
    const proposal = createJejuTripProposal();
    const alex = deriveParticipantShareExplanation(proposal, "alex");

    expect(alex.share).toBeGreaterThan(0);
    expect(alex.included.map((item) => item.itemId)).toContain("saturday-airbnb");
    expect(alex.excluded.map((item) => item.itemId)).toContain("friday-airbnb");
    expect(alex.summary).toContain("Alex's share");
  });

  it("prioritizes action blockers over passive metrics", () => {
    const proposal = withStatuses({ alex: "requested_changes", mina: "pending" });
    const queue = deriveActionQueue({ ...defaultGroup, proposals: [{ ...proposal, status: "changes_requested" }] });

    expect(queue[0]).toMatchObject({ title: "Alex asked for a change", actionLabel: "Resolve change" });
  });

  it("does not mutate deterministic totals", () => {
    const proposal = createJejuTripProposal();
    const totalBefore = proposal.calculationResult?.totalCost;

    deriveReadinessSummary(proposal);
    deriveParticipantShareExplanation(proposal, "mina");
    deriveActionQueue({ ...defaultGroup, proposals: [proposal] });

    expect(proposal.calculationResult?.totalCost).toBe(totalBefore);
    expect(proposal.calculationResult?.totalCost).toBe(570000);
  });
});
