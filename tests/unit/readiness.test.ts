import { describe, expect, it } from "vitest";
import { defaultGroup } from "@/lib/demo-data";
import { deriveActionQueue, deriveParticipantShareExplanation, deriveReadinessSummary, deriveSplitReadiness } from "@/lib/readiness";
import { createHanRiverBbqProposal, recalculateProposal } from "@/lib/prototype-proposals";
import type { Proposal } from "@/lib/types";

function withStatuses(statuses: Record<string, Proposal["participants"][number]["status"]>, proposal = createHanRiverBbqProposal()): Proposal {
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
    const draft = createHanRiverBbqProposal();
    expect(deriveReadinessSummary(draft)).toMatchObject({ title: "Human Review Required", nextAction: "Send proposal for agreement" });

    const waiting = withStatuses({ you: "accepted", ali: "pending", daniel: "accepted", sarah: "accepted", mira: "accepted", hakim: "accepted", adam: "accepted", minji: "accepted" });
    expect(deriveReadinessSummary({ ...waiting, status: "waiting_for_responses" }).blockers.join(" ")).toContain("Waiting for Ali");

    const changed = withStatuses({ daniel: "requested_changes" });
    expect(deriveReadinessSummary({ ...changed, status: "changes_requested" })).toMatchObject({ title: "Not Ready Yet", nextAction: "Resolve changes" });

    const optedOut = withStatuses({ minji: "opted_out" });
    expect(deriveReadinessSummary({ ...optedOut, status: "recalculation_needed" }).blockers.join(" ")).toContain("opted out");

    const safe = withStatuses({ you: "accepted", ali: "accepted", daniel: "accepted", sarah: "accepted", mira: "accepted", hakim: "accepted", adam: "accepted", minji: "accepted" });
    const confirmed = { ...safe, paymentRecords: safe.paymentRecords?.map((record) => ({ ...record, status: "confirmed" as const })) };
    expect(deriveReadinessSummary({ ...confirmed, status: "safe_to_book" })).toMatchObject({ title: "Ready to Settle", nextAction: "Settle with confidence" });

    expect(deriveReadinessSummary({ ...confirmed, status: "settled" })).toMatchObject({ title: "Collected" });
  });

  it("explains included and excluded participant share items", () => {
    const proposal = createHanRiverBbqProposal();
    const daniel = deriveParticipantShareExplanation(proposal, "daniel");

    expect(daniel.share).toBeGreaterThan(0);
    expect(daniel.included.map((item) => item.itemId)).toContain("drinks");
    expect(daniel.excluded.map((item) => item.itemId)).toContain("meat");
    expect(daniel.summary).toContain("Daniel's share");
  });

  it("prioritizes action blockers over passive metrics", () => {
    const proposal = withStatuses({ daniel: "requested_changes", ali: "pending" });
    const queue = deriveActionQueue({ ...defaultGroup, proposals: [{ ...proposal, status: "changes_requested" }] });

    expect(queue[0]).toMatchObject({ title: "Daniel asked for a change", actionLabel: "Resolve change" });
  });

  it("derives split readiness for operations surfaces", () => {
    const proposal = createHanRiverBbqProposal();
    const readiness = deriveSplitReadiness(proposal);

    expect(readiness).toMatchObject({
      state: "needs_review",
      label: "Needs review",
      nextAction: "Confirm payment claim",
      claimedPayments: 1,
      changeRequests: 0,
      responseProgress: { confirmed: 1, total: 8 }
    });
    expect(readiness.blockers.join(" ")).toContain("payment claim needs organizer confirmation");

    const safe = withStatuses({ you: "accepted", ali: "accepted", daniel: "accepted", sarah: "accepted", mira: "accepted", hakim: "accepted", adam: "accepted", minji: "accepted" });
    const confirmed = {
      ...safe,
      status: "safe_to_book" as const,
      paymentRecords: safe.paymentRecords?.map((record) => ({ ...record, status: "confirmed" as const }))
    };

    expect(deriveSplitReadiness(confirmed)).toMatchObject({
      state: "ready",
      label: "Ready to settle",
      nextAction: "Mark settled"
    });
  });

  it("does not mutate deterministic totals", () => {
    const proposal = createHanRiverBbqProposal();
    const totalBefore = proposal.calculationResult?.totalCost;

    deriveReadinessSummary(proposal);
    deriveParticipantShareExplanation(proposal, "mira");
    deriveActionQueue({ ...defaultGroup, proposals: [proposal] });

    expect(proposal.calculationResult?.totalCost).toBe(totalBefore);
    expect(proposal.calculationResult?.totalCost).toBe(128000);
  });
});
