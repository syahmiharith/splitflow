import { describe, expect, it } from "vitest";
import { filterProposals } from "@/lib/proposal-filters";
import { demoProposal } from "@/lib/demo-data";
import type { Proposal } from "@/lib/types";

function withStatus(status: Proposal["status"], id: string = status): Proposal {
  return { ...demoProposal, id, status, title: `${status} proposal` };
}

describe("proposal filters", () => {
  it("filters by split workflow states", () => {
    const ready = {
      ...withStatus("safe_to_book", "ready"),
      participants: demoProposal.participants.map((participant) => ({ ...participant, status: "accepted" as const })),
      paymentRecords: demoProposal.paymentRecords?.map((record) => ({ ...record, status: "confirmed" as const }))
    };
    const changed = {
      ...withStatus("changes_requested", "changed"),
      participants: demoProposal.participants.map((participant) =>
        participant.id === "daniel" ? { ...participant, status: "requested_changes" as const } : participant
      )
    };
    const proposals = [
      withStatus("draft"),
      withStatus("waiting_for_responses"),
      changed,
      ready,
      withStatus("settled"),
      withStatus("archived")
    ];

    expect(filterProposals(proposals, "needs_action", "").map((proposal) => proposal.id)).toEqual(["draft", "waiting_for_responses", "changed"]);
    expect(filterProposals(proposals, "drafts", "").map((proposal) => proposal.id)).toEqual(["draft"]);
    expect(filterProposals(proposals, "waiting_responses", "").map((proposal) => proposal.id)).toEqual(["waiting_for_responses"]);
    expect(filterProposals(proposals, "changes_requested", "").map((proposal) => proposal.id)).toEqual(["changed"]);
    expect(filterProposals(proposals, "ready_to_settle", "").map((proposal) => proposal.id)).toEqual(["ready"]);
    expect(filterProposals(proposals, "settled", "").map((proposal) => proposal.id)).toEqual(["settled"]);
    expect(filterProposals(proposals, "all", "").map((proposal) => proposal.id)).toEqual(["draft", "waiting_for_responses", "changed", "ready", "settled"]);
  });

  it("searches title, participant, item, status, and recommendation", () => {
    const proposals = [demoProposal];

    expect(filterProposals(proposals, "all", "daniel")).toHaveLength(1);
    expect(filterProposals(proposals, "all", "meat")).toHaveLength(1);
    expect(filterProposals(proposals, "all", "draft")).toHaveLength(1);
    expect(filterProposals(proposals, "all", "not-a-match")).toHaveLength(0);
  });
});
