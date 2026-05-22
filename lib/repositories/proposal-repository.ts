import type { Proposal } from "@/lib/domain/proposal-types";

export type ProposalRepository = {
  get(id: string): Promise<Proposal | undefined>;
  save(proposal: Proposal): Promise<Proposal>;
  list(): Promise<Proposal[]>;
};
