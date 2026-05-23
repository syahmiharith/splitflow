export function formatKrw(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(amount);
}

export function compactTime(dateIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateIso));
}

export function humanStatus(status: string): string {
  const labels: Record<string, string> = {
    proposal_draft: "Trip Split",
    parser_review: "Split Details",
    allocation_resolution: "Needs Your Choice",
    itemized_breakdown: "Split Details",
    eligibility_matrix: "Who Is Included",
    settlement_plan: "Ready to Book Check",
    settlement_ledger: "Payment Notes",
    change_request_summary: "Change Requests",
    risk_summary: "Booking Risk",
    draft: "Draft",
    sent: "Sent",
    waiting_for_responses: "Still Waiting",
    changes_requested: "Changes Needed",
    recalculation_needed: "Changes Needed",
    needs_reconfirmation: "Check Again",
    safe_to_book: "Ready to Book",
    partially_paid: "Partly Paid",
    booked: "Booked",
    settling: "Collecting",
    settled: "Settled",
    not_sent: "Not Sent",
    pending: "Still Waiting",
    accepted: "I'm In",
    opted_out: "I'm Out",
    requested_changes: "Asked for a Change",
    paid: "Paid",
    disputed: "Disputed",
    mixed_item_based: "By Item",
    unit_based: "By Stay"
  };
  if (labels[status]) return labels[status];
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
