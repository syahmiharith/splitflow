import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { initialState } from "@/lib/demo-data";
import { deriveGroupAnalytics } from "@/lib/analytics";
import type { AgentRun, ArtifactRecord, Proposal, ProposalRecord, ProposalRevisionChange, ProposalVersion, SplitFlowGroup } from "@/lib/types";
import { SERVER_STATE_SCHEMA_VERSION, type WorkflowServerState } from "@/lib/workflow/schema";

function now(): string {
  return new Date().toISOString();
}

function defaultStatePath(): string {
  return process.env.SPLITFLOW_STATE_FILE ?? path.join(process.cwd(), ".splitflow", "server-state.json");
}

function versionId(proposalId: string, version: number): string {
  return `${proposalId}-v${version}`;
}

function amountChanges(previous: Proposal | undefined, next: Proposal): ProposalRevisionChange[] {
  if (!previous) return [];
  return previous.participants
    .map((participant) => {
      const beforeAmount = previous.calculationResult?.fairShareByParticipant[participant.id] ?? participant.shareAmount;
      const afterParticipant = next.participants.find((item) => item.id === participant.id);
      const afterAmount = next.calculationResult?.fairShareByParticipant[participant.id] ?? afterParticipant?.shareAmount ?? 0;
      return {
        participantId: participant.id,
        participantName: afterParticipant?.name ?? participant.name,
        beforeAmount,
        afterAmount
      };
    })
    .filter((change) => change.beforeAmount !== change.afterAmount);
}

function normalizeGroup(group: SplitFlowGroup): SplitFlowGroup {
  return {
    ...group,
    proposals: group.proposals.map((proposal) => ({
      ...proposal,
      version: proposal.version ?? 1,
      revisionHistory: proposal.revisionHistory ?? []
    })),
    analyticsSummary: deriveGroupAnalytics(group)
  };
}

function seedState(): WorkflowServerState {
  const seededGroups = initialState.groups.map(normalizeGroup);
  const proposalVersions: ProposalVersion[] = [];
  const proposalRecords: ProposalRecord[] = [];
  const artifactRecords: ArtifactRecord[] = [];

  for (const group of seededGroups) {
    for (const proposal of group.proposals) {
      const version = proposal.version ?? 1;
      const currentVersionId = versionId(proposal.id, version);
      proposalRecords.push({
        id: proposal.id,
        groupId: group.id,
        currentVersionId,
        versionIds: [currentVersionId],
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      });
      proposalVersions.push({
        id: currentVersionId,
        proposalId: proposal.id,
        groupId: group.id,
        version,
        transitionType: "draft_created",
        actor: "SplitFlow",
        reason: "Seeded canonical demo proposal.",
        proposal,
        amountChanges: [],
        createdAt: proposal.createdAt
      });
    }

    for (const artifact of group.artifacts) {
      artifactRecords.push({
        id: artifact.id,
        artifact,
        groupId: group.id,
        proposalId: artifact.proposalId,
        proposalVersionId: artifact.proposalId ? versionId(artifact.proposalId, artifact.proposalVersion ?? 1) : undefined,
        kind: artifact.type,
        state: artifact.state === "superseded" ? "superseded" : "active",
        supersedesArtifactId: artifact.supersedesArtifactId,
        createdAt: artifact.createdAt
      });
    }
  }

  return {
    schemaVersion: SERVER_STATE_SCHEMA_VERSION,
    groups: seededGroups,
    proposalRecords,
    proposalVersions,
    artifactRecords,
    runs: initialState.agentRuns,
    idempotencyKeys: {},
    updatedAt: now()
  };
}

function normalizeState(value: unknown): WorkflowServerState {
  if (!value || typeof value !== "object") return seedState();
  const record = value as Partial<WorkflowServerState> & { groups?: unknown };
  const groups = Array.isArray(record.groups) && record.groups.length > 0 ? (record.groups as SplitFlowGroup[]).map(normalizeGroup) : seedState().groups;
  const base = seedState();
  return {
    schemaVersion: SERVER_STATE_SCHEMA_VERSION,
    groups,
    proposalRecords: Array.isArray(record.proposalRecords) ? record.proposalRecords : base.proposalRecords,
    proposalVersions: Array.isArray(record.proposalVersions) ? record.proposalVersions : base.proposalVersions,
    artifactRecords: Array.isArray(record.artifactRecords) ? record.artifactRecords : base.artifactRecords,
    runs: Array.isArray(record.runs) ? record.runs : [],
    idempotencyKeys: record.idempotencyKeys && typeof record.idempotencyKeys === "object" ? record.idempotencyKeys : {},
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now()
  };
}

export class FileWorkflowRepository {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath = defaultStatePath()) {}

  async read(): Promise<WorkflowServerState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeState(JSON.parse(raw));
    } catch {
      const state = seedState();
      await this.write(state);
      return state;
    }
  }

  async write(state: WorkflowServerState): Promise<WorkflowServerState> {
    const next = normalizeState({ ...state, updatedAt: now() });
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, JSON.stringify(next, null, 2), "utf8");
      await rename(tempPath, this.filePath);
    });
    await this.writeQueue;
    return next;
  }

  async update(updater: (state: WorkflowServerState) => WorkflowServerState | Promise<WorkflowServerState>): Promise<WorkflowServerState> {
    const state = await this.read();
    const next = await updater(state);
    return this.write(next);
  }

  async getRun(runId: string): Promise<AgentRun | undefined> {
    return (await this.read()).runs.find((run) => run.id === runId);
  }

  createVersion(input: {
    state: WorkflowServerState;
    groupId: string;
    proposal: Proposal;
    parentProposal?: Proposal;
    transitionType: ProposalVersion["transitionType"];
    actor: string;
    reason: string;
  }): WorkflowServerState {
    const previousRecord = input.state.proposalRecords.find((record) => record.id === input.proposal.id);
    const version = previousRecord ? previousRecord.versionIds.length + 1 : input.proposal.version ?? 1;
    const nextProposal = { ...input.proposal, version };
    const nextVersionId = versionId(input.proposal.id, version);
    const parentVersionId = previousRecord?.currentVersionId;
    const proposalVersion: ProposalVersion = {
      id: nextVersionId,
      proposalId: input.proposal.id,
      groupId: input.groupId,
      version,
      parentVersionId,
      transitionType: input.transitionType,
      actor: input.actor,
      reason: input.reason,
      proposal: nextProposal,
      amountChanges: amountChanges(input.parentProposal, nextProposal),
      createdAt: now()
    };
    const proposalRecord: ProposalRecord = previousRecord
      ? {
          ...previousRecord,
          currentVersionId: nextVersionId,
          versionIds: [...previousRecord.versionIds, nextVersionId],
          updatedAt: proposalVersion.createdAt
        }
      : {
          id: input.proposal.id,
          groupId: input.groupId,
          currentVersionId: nextVersionId,
          versionIds: [nextVersionId],
          createdAt: input.proposal.createdAt,
          updatedAt: proposalVersion.createdAt
        };

    return {
      ...input.state,
      proposalRecords: [...input.state.proposalRecords.filter((record) => record.id !== proposalRecord.id), proposalRecord],
      proposalVersions: [...input.state.proposalVersions, proposalVersion]
    };
  }
}

export function getWorkflowRepository(): FileWorkflowRepository {
  return new FileWorkflowRepository();
}
