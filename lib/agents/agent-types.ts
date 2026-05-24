import type {
  AiModelName,
  AgentModel,
  ModelRoutingContext
} from "@/lib/ai/model-policy";
import type {
  ExpenseType,
  Proposal,
  RiskAssessment,
  SplitCalculationInput,
  SplitCalculationResult,
  SplitMethod,
  SplitParticipantInput
} from "@/lib/domain/proposal-types";

export type AgentName =
  | "Orchestrator Agent"
  | "Intake Agent"
  | "Split Planning Agent"
  | "Proposal Agent"
  | "Participant Communication Agent"
  | "Response Tracking Agent"
  | "Recalculation Agent"
  | "Risk Decision Agent"
  | "Recommendation Agent";

export type OrchestratorEvent =
  | { type: "user_message"; message: string; workflowId?: string; groupId?: string; chatId?: string; sourceMessageId?: string; idempotencyKey?: string }
  | { type: "send_proposal"; proposalId: string }
  | { type: "participant_response"; proposalId: string; participantId: string; response: "accepted" | "opted_out" | "requested_change"; note?: string }
  | { type: "direct_agent_call"; agentName: Exclude<AgentName, "Orchestrator Agent"> };

export type AgentTraceStep = {
  agent: AgentName;
  action: string;
  status: "completed" | "blocked" | "skipped";
  detail: string;
};

export type AgentAction =
  | "ask_clarifying_question"
  | "draft_proposal"
  | "send_proposal"
  | "send_participant_message"
  | "record_response"
  | "recalculate"
  | "evaluate_risk"
  | "recommend_next_action";

export type IntakeResult = {
  model: AgentModel;
  expenseType: ExpenseType;
  totalAmount?: number;
  currency: "KRW";
  participants: SplitParticipantInput[];
  explicitMethod?: SplitMethod;
  costItems: Array<{ label: string; amount: number }>;
  constraints: string[];
  missingFields: Array<"totalAmount" | "participants" | "splitMethod">;
  sourceText: string;
};

export type SplitPlan = {
  method: SplitMethod;
  reason: string;
  calculatorInput: SplitCalculationInput;
  assumptions: string[];
};

export type ProposalDraft = {
  title: string;
  organizerName: string;
  expenseType: ExpenseType;
  assumptions: string[];
  requiredConfirmations: string[];
};

export type ProposalSummary = {
  id: string;
  title: string;
  totalAmount: number;
  participantCount: number;
  status: string;
};

export type ParticipantMessage = {
  model: AgentModel;
  participantId: string;
  message: string;
  actions: Array<"accept" | "request_change" | "opt_out">;
};

export type RecalculationResult = {
  proposal: Proposal;
  changedParticipantIds: string[];
  auditTrail: Array<{ participantId: string; oldAmount: number; newAmount: number }>;
  explanation: string;
};

export type RecommendationResult = {
  model: AiModelName;
  primaryAction: "proceed_to_pay" | "send_reminder" | "request_reconfirmation" | "resolve_change_request" | "do_not_pay";
  confidence: "low" | "medium" | "high";
  recommendation: string;
  reason: string;
  alternatives: string[];
  suggestedMessage?: string;
};

export type RecommendationRoutingContext = ModelRoutingContext;

export type WorkflowContext = {
  proposal?: Proposal;
  intake?: IntakeResult;
  splitPlan?: SplitPlan;
  calculation?: SplitCalculationResult;
  risk?: RiskAssessment;
  recommendation?: RecommendationResult;
};

export type AgentInput<T = unknown> = {
  context: WorkflowContext;
  payload: T;
};

export type AgentResult<T = unknown> = {
  output: T;
  trace: AgentTraceStep[];
};

export type OpenAiAgentsSdkRuntimeMetadata = {
  envFlagEnabled: boolean;
  apiKeyPresent: boolean;
  runtimeCreated: boolean;
  attempted: boolean;
  invoked: boolean;
  returnedOutput: boolean;
  errorCode?: string;
};

export type AgentRuntimeMetadata = {
  route: "/api/agent";
  backend: "runOrchestrator";
  openAiAgentsSdk: OpenAiAgentsSdkRuntimeMetadata;
};

export type OrchestratorResponse = {
  message: string;
  proposal?: Proposal;
  risk?: RiskAssessment;
  recommendation?: RecommendationResult;
  nextActions: string[];
  trace: AgentTraceStep[];
  runtime?: AgentRuntimeMetadata;
};
