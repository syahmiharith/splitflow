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

export type TimelineEvent = {
  id: string;
  at: string;
  actor: string;
  text: string;
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
  status: ProposalStatus;
  isBooked: boolean;
  createdAt: string;
  updatedAt: string;
  fairnessNote: string;
  recommendation: string;
  timeline?: TimelineEvent[];
  calculationResult?: ProposalCalculationResult;
  aiExplanation?: string;
};

export type BotMessage = {
  id: string;
  sender: "user" | "bot" | "agent";
  content: string;
  createdAt: string;
  relatedProposalId?: string;
  agentName?: string;
};

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

export type UserMode = "organizer" | "you" | "amir" | "aisyah" | "daniel" | "ali" | "sarah" | "aiman" | "mina";

export type AppState = {
  currentUser: UserMode;
  proposals: Proposal[];
  messages: BotMessage[];
  notifications: Notification[];
  agentSteps: AgentStep[];
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
