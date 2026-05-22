export type CurrencyCode = "KRW";

export type SplitMethod = "equal" | "weighted" | "percentage" | "fixed";

export type ExpenseType =
  | "meal"
  | "travel_accommodation"
  | "subscription"
  | "bill"
  | "gift"
  | "general";

export type ProposalStatus =
  | "draft"
  | "pending_confirmation"
  | "sent"
  | "partially_accepted"
  | "accepted"
  | "change_requested"
  | "recalculation_required"
  | "reconfirmation_required"
  | "ready_to_pay"
  | "blocked";

export type ParticipantResponseStatus =
  | "pending"
  | "accepted"
  | "opted_out"
  | "requested_change"
  | "reconfirmation_required";

export type PaymentStatus = "unpaid" | "paid" | "not_applicable";

export type ExpenseItem = {
  id: string;
  label: string;
  amount: number;
  participantIds?: string[];
};

export type SplitParticipantInput = {
  id: string;
  name: string;
  weight?: number;
  percentage?: number;
  fixedAmount?: number;
  metadata?: Record<string, string | number | boolean>;
};

export type ParticipantShare = {
  participantId: string;
  name: string;
  amount: number;
  weight?: number;
  percentage?: number;
  fixedAmount?: number;
};

export type SplitCalculationInput = {
  totalAmount: number;
  currency: CurrencyCode;
  method: SplitMethod;
  participants: SplitParticipantInput[];
};

export type SplitCalculationResult = {
  totalAmount: number;
  currency: CurrencyCode;
  method: SplitMethod;
  shares: ParticipantShare[];
  remainder: number;
  explanation: string;
};

export type ProposalParticipant = {
  id: string;
  name: string;
  amountOwed: number;
  responseStatus: ParticipantResponseStatus;
  paymentStatus: PaymentStatus;
  weight?: number;
  percentage?: number;
  fixedAmount?: number;
  previousAmountOwed?: number;
  responseNote?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type ChangeRequest = {
  participantId: string;
  note: string;
  createdAt: string;
  resolved: boolean;
};

export type Proposal = {
  id: string;
  title: string;
  organizerName: string;
  expenseType: ExpenseType;
  totalAmount: number;
  currency: CurrencyCode;
  splitMethod: SplitMethod;
  items: ExpenseItem[];
  participants: ProposalParticipant[];
  status: ProposalStatus;
  assumptions: string[];
  requiredConfirmations: string[];
  fairnessExplanation: string;
  calculation: SplitCalculationResult;
  changeRequests: ChangeRequest[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

export type RiskLevel = "low" | "medium" | "high" | "blocked";

export type RiskAssessment = {
  level: RiskLevel;
  reasons: string[];
  recommendedNextAction: string;
  frontingExposure: number;
  pendingParticipantIds: string[];
};
