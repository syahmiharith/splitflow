export type ParticipantStatus =
  | "not_sent"
  | "pending"
  | "accepted"
  | "opted_out"
  | "requested_changes"
  | "needs_reconfirmation"
  | "paid";

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
  | "needs_reconfirmation"
  | "safe_to_book"
  | "booked"
  | "settling"
  | "settled";

export type CostItem = {
  id: string;
  label: string;
  amount: number;
  paidBy?: string;
};

export type Proposal = {
  id: string;
  title: string;
  description: string;
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

export type UserMode = "organizer" | "amir" | "aisyah" | "daniel" | "ali" | "sarah" | "aiman";

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
