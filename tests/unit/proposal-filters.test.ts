import { describe, expect, it } from "vitest";
import { filterProposals } from "@/lib/proposal-filters";
import { demoProposal } from "@/lib/demo-data";
import type { Proposal } from "@/lib/types";

function withStatus(status: Proposal["status"], id = status): Proposal {
  return { ...demoProposal, id, status, title: `${status} proposal` };
}

describe("proposal filters", () => {
  it("filters by active, draft, sent, and paid states", () => {
    const proposals = [withStatus("draft"), withStatus("waiting_for_responses"), withStatus("settled"), withStatus("archived")];

    expect(filterProposals(proposals, "active", "").map((proposal) => proposal.status)).toEqual(["draft", "waiting_for_responses"]);
    expect(filterProposals(proposals, "draft", "").map((proposal) => proposal.status)).toEqual(["draft"]);
    expect(filterProposals(proposals, "sent", "").map((proposal) => proposal.status)).toEqual(["waiting_for_responses"]);
    expect(filterProposals(proposals, "paid", "").map((proposal) => proposal.status)).toEqual(["settled"]);
  });

  it("searches title, participant, item, status, and recommendation", () => {
    const proposals = [demoProposal];

    expect(filterProposals(proposals, "active", "daniel")).toHaveLength(1);
    expect(filterProposals(proposals, "active", "airbnb")).toHaveLength(1);
    expect(filterProposals(proposals, "active", "draft")).toHaveLength(1);
    expect(filterProposals(proposals, "active", "not-a-match")).toHaveLength(0);
  });
});
