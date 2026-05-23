import type { AgentRun, AgentRunEvent, ArtifactRecord, ProposalVersion } from "@/lib/types";
import { FileWorkflowRepository, getWorkflowRepository } from "@/lib/workflow/file-workflow-repository";
import type {
  ProposalHistoryArtifactSummary,
  ProposalHistoryResult,
  ProposalHistoryRunSummary,
  WorkflowServerState
} from "@/lib/workflow/schema";

type PublicArtifactState = ProposalHistoryArtifactSummary["state"];

const REVIEW_REQUIRED_KINDS = new Set<ArtifactRecord["kind"]>(["parser_review", "proposal_draft", "allocation_resolution", "change_request_summary"]);

function normalizeArtifactState(record: ArtifactRecord, version?: ProposalVersion): PublicArtifactState {
  if (record.state === "superseded" || record.artifact.state === "superseded" || record.supersededByArtifactId) return "superseded";
  if (record.state === "archived" || record.artifact.state === "archived") return "archived";
  if (record.artifact.state === "published") return "published";
  if (record.artifact.state === "ready") return "ready";
  if (version && version.proposal.status !== "draft" && record.kind === "proposal_draft") return "published";
  if (REVIEW_REQUIRED_KINDS.has(record.kind)) return "review_required";
  return "ready";
}

function sanitizeEvent(event: AgentRunEvent): AgentRunEvent {
  if (event.type === "run_failed") {
    return { ...event, detail: "Workflow run failed safely." };
  }
  return event;
}

function sanitizeRun(run: AgentRun): ProposalHistoryRunSummary {
  return {
    id: run.id,
    groupId: run.groupId,
    chatId: run.chatId,
    sourceMessageId: run.sourceMessageId,
    status: run.status,
    retryCount: run.retryCount,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    error: run.status === "failed" ? "Workflow run failed safely." : undefined,
    events: run.events.map(sanitizeEvent)
  };
}

function runTouchesProposal(run: AgentRun, proposalId: string, artifactIds: Set<string>): boolean {
  return run.events.some((event) => {
    if (event.type === "proposal_version_created") return event.proposalId === proposalId;
    if (event.type === "artifact_staged") return artifactIds.has(event.artifactId);
    return false;
  });
}

export async function getProposalHistory(
  proposalId: string,
  groupId?: string,
  repository: FileWorkflowRepository = getWorkflowRepository()
): Promise<ProposalHistoryResult | undefined> {
  const state = await repository.read();
  return projectProposalHistory(state, proposalId, groupId);
}

export function projectProposalHistory(state: WorkflowServerState, proposalId: string, groupId?: string): ProposalHistoryResult | undefined {
  const proposalRecord = state.proposalRecords.find((record) => record.id === proposalId && (!groupId || record.groupId === groupId));
  if (!proposalRecord) return undefined;

  const versions = proposalRecord.versionIds
    .map((versionId) => state.proposalVersions.find((version) => version.id === versionId))
    .filter((version): version is ProposalVersion => Boolean(version))
    .sort((first, second) => first.version - second.version);
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const artifactRecords = state.artifactRecords
    .filter((record) => record.proposalId === proposalId && (!groupId || record.groupId === groupId))
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const artifactIds = new Set(artifactRecords.map((record) => record.id));

  return {
    proposalRecord,
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      parentVersionId: version.parentVersionId,
      transitionType: version.transitionType,
      actor: version.actor,
      reason: version.reason,
      amountChanges: version.amountChanges.length,
      createdAt: version.createdAt
    })),
    artifacts: artifactRecords.map((record) => {
      const state = normalizeArtifactState(record, record.proposalVersionId ? versionById.get(record.proposalVersionId) : undefined);
      return {
        id: record.id,
        title: record.artifact.title,
        kind: record.kind,
        state,
        recordState: record.state,
        active: state !== "superseded" && state !== "archived",
        runId: record.runId,
        proposalId: record.proposalId,
        proposalVersionId: record.proposalVersionId,
        supersedesArtifactId: record.supersedesArtifactId,
        supersededByArtifactId: record.supersededByArtifactId,
        createdAt: record.createdAt
      };
    }),
    runs: state.runs
      .filter((run) => (!groupId || run.groupId === groupId) && runTouchesProposal(run, proposalId, artifactIds))
      .sort((first, second) => first.startedAt.localeCompare(second.startedAt))
      .map(sanitizeRun)
  };
}
