import type {
  AgentRun,
  Artifact,
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
