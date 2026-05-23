import type {
  AgentRun,
  AgentRunEvent,
  Artifact,
  ArtifactLifecycleState,
  ArtifactRecord,
  BotMessage,
  Proposal,
  ProposalRecord,
  ProposalVersion,
  SplitFlowGroup
} from "@/lib/types";

export const SERVER_STATE_SCHEMA_VERSION = 1;

export type WorkflowServerState = {
  schemaVersion: number;
  groups: SplitFlowGroup[];
  proposalRecords: ProposalRecord[];
  proposalVersions: ProposalVersion[];
  artifactRecords: ArtifactRecord[];
  runs: AgentRun[];
  idempotencyKeys: Record<string, string>;
  updatedAt: string;
};

export type WorkflowRunRequest = {
  runId?: string;
  groupId: string;
  chatId: string;
  message: string;
  sourceMessageId?: string;
  idempotencyKey: string;
  retryCount?: number;
};

export type WorkflowRunResult = {
  run: AgentRun;
  group: SplitFlowGroup;
  proposal?: Proposal;
  artifacts: Artifact[];
  assistantMessage?: BotMessage;
};

export type WorkflowActionRequest =
  | { type: "send_proposal"; groupId: string; chatId: string; proposalId: string; idempotencyKey: string }
  | {
      type: "participant_response";
      groupId: string;
      chatId: string;
      proposalId: string;
      participantId: string;
      status: "accepted" | "opted_out" | "requested_changes";
      note?: string;
      idempotencyKey: string;
    }
  | { type: "accept_change"; groupId: string; chatId: string; proposalId: string; idempotencyKey: string }
  | { type: "mark_paid"; groupId: string; chatId: string; proposalId: string; participantId: string; idempotencyKey: string }
  | { type: "mark_settled"; groupId: string; chatId: string; proposalId: string; idempotencyKey: string };

export type WorkflowActionResult = {
  group: SplitFlowGroup;
  proposal?: Proposal;
  artifacts: Artifact[];
};

export type ProposalHistoryVersionSummary = {
  id: string;
  version: number;
  parentVersionId?: string;
  transitionType: ProposalVersion["transitionType"];
  actor: string;
  reason: string;
  amountChanges: number;
  createdAt: string;
};

export type ProposalHistoryArtifactSummary = {
  id: string;
  title: string;
  kind: ArtifactRecord["kind"];
  state: Exclude<ArtifactLifecycleState, "staged">;
  recordState: ArtifactRecord["state"];
  active: boolean;
  runId?: string;
  proposalId?: string;
  proposalVersionId?: string;
  supersedesArtifactId?: string;
  supersededByArtifactId?: string;
  createdAt: string;
};

export type ProposalHistoryRunSummary = {
  id: string;
  groupId: string;
  chatId: string;
  sourceMessageId: string;
  status: AgentRun["status"];
  retryCount: number;
  createdAt: string;
  startedAt: string;
  endedAt?: string;
  error?: string;
  events: AgentRunEvent[];
};

export type ProposalHistoryResult = {
  proposalRecord: ProposalRecord;
  versions: ProposalHistoryVersionSummary[];
  artifacts: ProposalHistoryArtifactSummary[];
  runs: ProposalHistoryRunSummary[];
};
