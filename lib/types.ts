export type ParticipantStatus =
  | "not_sent"
  | "pending"
  | "accepted"
  | "opted_out"
  | "requested_changes"
  | "needs_reconfirmation"
  | "paid"
  | "disputed";

export type PaymentStatus = "unpaid" | "paid" | "review" | "remind";

export type Participant = {
  id: string;
  name: string;
  status: ParticipantStatus;
  shareAmount: number;
  paymentStatus: PaymentStatus;
  units?: number;
  customAmount?: number;
  roleNote?: string;
  changeRequestNote?: string;
  lastRespondedAt?: string;
};

export type SplitMethod = "equal" | "custom" | "unit_based" | "mixed_item_based";

export type ProposalStatus =
  | "draft"
  | "sent"
  | "waiting_for_responses"
  | "changes_requested"
  | "recalculation_needed"
  | "needs_reconfirmation"
  | "safe_to_book"
  | "partially_paid"
  | "booked"
  | "settling"
  | "settled"
  | "archived";

export type CostItem = {
  id: string;
  label: string;
  amount: number;
  paidBy?: string;
  paidByParticipantId?: string;
  includedParticipantIds?: string[];
  excludedParticipantIds?: string[];
};

export type ParticipantCredit = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  note: string;
};

export type PaymentRecordKind = "prior_payment" | "settlement_payment" | "manual_adjustment";
export type PaymentRecordStatus = "claimed" | "confirmed" | "disputed" | "void";
export type PaymentProofType = "none" | "note" | "reference" | "mock_attachment";

export type PaymentRecord = {
  id: string;
  groupId: string;
  proposalId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  currency: "KRW";
  kind: PaymentRecordKind;
  status: PaymentRecordStatus;
  proofType?: PaymentProofType;
  proofNote?: string;
  reference?: string;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  sourceText?: string;
};

export type TimelineEvent = {
  id: string;
  at: string;
  actor: string;
  text: string;
};

export type ProposalRevisionChange = {
  participantId: string;
  participantName: string;
  beforeAmount: number;
  afterAmount: number;
};

export type ProposalRevision = {
  id: string;
  version: number;
  previousVersion: number;
  createdAt: string;
  actor: string;
  reason: string;
  changeRequestNote?: string;
  amountChanges: ProposalRevisionChange[];
};

export type SettlementInstruction = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  text: string;
};

export type ProposalCalculationResult = {
  totalCost: number;
  totalPaidByParticipant: Record<string, number>;
  fairShareByParticipant: Record<string, number>;
  netBalanceByParticipant: Record<string, number>;
  settlementInstructions: SettlementInstruction[];
  itemizedBreakdown: Array<{
    itemId: string;
    label: string;
    amount: number;
    paidByParticipantId: string;
    eligibleParticipantIds: string[];
    shareByParticipant: Record<string, number>;
    auditText: string;
  }>;
  roundingAdjustments: Array<{
    itemId: string;
    participantId: string;
    amount: number;
    reason: string;
  }>;
  validationWarnings: string[];
  auditExplanation: string[];
};

export type Proposal = {
  id: string;
  version?: number;
  revisionHistory?: ProposalRevision[];
  title: string;
  description: string;
  groupId?: string;
  organizerId?: string;
  organizerName: string;
  totalCost: number;
  currency: "KRW";
  splitMethod: SplitMethod;
  unitLabel?: string;
  deadline: string;
  cancellationRule: string;
  participants: Participant[];
  costItems: CostItem[];
  credits?: ParticipantCredit[];
  paymentRecords?: PaymentRecord[];
  status: ProposalStatus;
  isBooked: boolean;
  createdAt: string;
  updatedAt: string;
  fairnessNote: string;
  recommendation: string;
  timeline?: TimelineEvent[];
  calculationResult?: ProposalCalculationResult;
  aiExplanation?: string;
  parserAssumptions?: string[];
  parserWarnings?: string[];
};

export type BotMessage = {
  id: string;
  sender: "user" | "bot" | "agent";
  content: string;
  createdAt: string;
  relatedProposalId?: string;
  agentName?: string;
};

export type ArtifactType =
  | "proposal_draft"
  | "parser_review"
  | "allocation_resolution"
  | "itemized_breakdown"
  | "eligibility_matrix"
  | "settlement_plan"
  | "settlement_ledger"
  | "change_request_summary"
  | "risk_summary";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  summary: string;
  proposalId?: string;
  proposalVersion?: number;
  state?: "staged" | "superseded";
  supersedesArtifactId?: string;
  details?: string[];
  sourceText?: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: BotMessage[];
  artifactIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AgentRunStatus = "running" | "completed" | "failed";

export type AgentRunEvent =
  | { id: string; runId: string; at: string; type: "run_started"; detail: string }
  | { id: string; runId: string; at: string; type: "step_completed"; step: string; detail: string }
  | { id: string; runId: string; at: string; type: "artifact_staged"; artifactId: string }
  | { id: string; runId: string; at: string; type: "run_completed"; detail: string }
  | { id: string; runId: string; at: string; type: "run_failed"; detail: string };

export type AgentRun = {
  id: string;
  groupId: string;
  chatId: string;
  sourceMessageId: string;
  status: AgentRunStatus;
  startedAt: string;
  endedAt?: string;
  eventIds: string[];
  events: AgentRunEvent[];
  error?: string;
};

export type AgentRunContext = {
  runId: string;
  groupId: string;
  chatId: string;
};

export type GroupAnalyticsSummary = {
  activeProposals: number;
  openChangeRequests: number;
  pendingSettlements: number;
  totalFronted: number;
  stillOwed: number;
  pendingResponses: number;
  confirmedPayments: number;
  claimedUnconfirmedCredits: number;
};

export type SplitFlowGroup = {
  id: string;
  name: string;
  description: string;
  members: Participant[];
  proposals: Proposal[];
  chats: ChatSession[];
  artifacts: Artifact[];
  analyticsSummary: GroupAnalyticsSummary;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePanel =
  | { type: "artifact"; artifactId: string }
  | { type: "proposal"; proposalId: string }
  | { type: "group_settings" }
  | null;

export type Notification = {
  id: string;
  participantId: string;
  proposalId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type AgentStatus = "completed" | "pending" | "running";

export type AgentStep = {
  id: string;
  name: string;
  description: string;
  time: string;
  status: AgentStatus;
};

export type UserMode = string;

export type AppState = {
  schemaVersion: number;
  migrationLog: string[];
  currentUser: UserMode;
  selectedGroupId?: string;
  selectedChatIdByGroupId?: Record<string, string>;
  groups: SplitFlowGroup[];
  workspacePanel?: WorkspacePanel;
  globalNotifications?: Notification[];
  agentSteps: AgentStep[];
  agentRuns: AgentRun[];
  aiUnavailable: boolean;
  lastAiError?: string;
};

export type ParticipantCounts = {
  accepted: number;
  pending: number;
  changes: number;
  paid: number;
  optedOut: number;
  needsReconfirmation: number;
};
