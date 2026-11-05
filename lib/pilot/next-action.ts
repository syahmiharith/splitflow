import { balances, type Split } from "./model";
export function nextAction(split: Split, email: string): string {
  if (
    split.repayments.some(
      (payment) => payment.to === email && payment.status === "reported",
    )
  )
    return "Confirm or dispute a reported payment";
  if (
    email === split.organizer &&
    Object.values(split.responses).some(
      (response) => response.status === "correction",
    )
  )
    return "Review requested corrections";
  if (split.expense.mode === "planned") {
    if (!split.responses[email])
      return "Review and accept or decline participation";
    if (
      split.expense.participants.some(
        (person) => !split.responses[person.email],
      )
    )
      return "Waiting for explicit participant responses";
    if (
      Object.values(split.responses).some(
        (response) => response.status === "declined",
      )
    )
      return "Resolve declined participation before proceeding";
    return "Participation agreed";
  }
  const balance = balances(split)[email];
  if (balance > 0) return "Repay a payer and report the transfer";
  if (balance < 0) return "Waiting for repayments";
  return "Your balance is settled";
}
