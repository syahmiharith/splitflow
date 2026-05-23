export type ParsedExpenseIntent =
  | "food"
  | "travel"
  | "movie"
  | "gift"
  | "household"
  | "shared_expense";

export type ParserStatus = "ready" | "needs_clarification" | "unsupported";
export type ParserConfidence = "high" | "medium" | "low";
export type ParserMode = "natural_prompt" | "receipt_text" | "simple_total" | "needs_clarification" | "unsupported";
export type AllocationStrategy =
  | "exact_item_amounts"
  | "single_total_equal_items"
  | "single_total_weighted_items"
  | "remaining_amount_allocation"
  | "unallocated_remainder"
  | "needs_user_resolution";

export type ParsedParticipant = {
  id: string;
  name: string;
  generated?: boolean;
};

export type ParsedExpenseItem = {
  id: string;
  label: string;
  amount?: number;
  paidByName?: string;
  includedParticipantNames?: string[];
  excludedParticipantNames?: string[];
  sourceText?: string;
};

export type ParsedPayer = {
  name: string;
  amount?: number;
  paysRest?: boolean;
  itemLabel?: string;
};

export type ParsedExclusion = {
  participantName: string;
  itemLabel?: string;
  reason: string;
  onlyIncludedItemLabel?: string;
};

export type ParsedCredit = {
  fromName: string;
  toName: string;
  amount: number;
  note: string;
};

export type ParserValidationIssue = {
  code:
    | "missing_amount"
    | "missing_participants"
    | "total_mismatch"
    | "ambiguous_item_amounts"
    | "unknown_exclusion_target"
    | "allocation_required"
    | "payer_mismatch"
    | "unsupported";
  severity: "warning" | "blocking";
  message: string;
};

export type ParserClarificationQuestion = {
  id: string;
  question: string;
};

export type ParsedExpenseDraft = {
  rawInput: string;
  mode: ParserMode;
  intent: ParsedExpenseIntent;
  title: string;
  currency: "KRW";
  statedTotal?: number;
  participantCount?: number;
  participants: ParsedParticipant[];
  items: ParsedExpenseItem[];
  payers: ParsedPayer[];
  exclusions: ParsedExclusion[];
  credits: ParsedCredit[];
  assumptions: string[];
  warnings: string[];
  allocationStrategy: AllocationStrategy;
  confidenceReasons: string[];
};

export type ParserResult = {
  status: ParserStatus;
  draft?: ParsedExpenseDraft;
  confidence: ParserConfidence;
  mode: ParserMode;
  issues: ParserValidationIssue[];
  clarificationQuestions: ParserClarificationQuestion[];
  normalizedSummary: string;
};
