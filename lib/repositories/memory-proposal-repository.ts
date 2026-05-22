import type { Proposal } from "@/lib/domain/proposal-types";
import type { ProposalRepository } from "@/lib/repositories/proposal-repository";

export class MemoryProposalRepository implements ProposalRepository {
  private proposals = new Map<string, Proposal>();

  constructor(initialProposals: Proposal[] = []) {
    for (const proposal of initialProposals) {
      this.proposals.set(proposal.id, proposal);
    }
  }

  async get(id: string): Promise<Proposal | undefined> {
    return this.proposals.get(id);
  }

  async save(proposal: Proposal): Promise<Proposal> {
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async list(): Promise<Proposal[]> {
    return [...this.proposals.values()];
  }
}
