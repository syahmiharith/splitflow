import { balances, claimState, type Split } from "./model";
export type SplitState = {
  stage: "needs_action" | "waiting" | "ready" | "settled";
  message: string;
};
export function splitState(split: Split, email: string): SplitState {
  if (split.repayments.some((p) => p.to === email && p.status === "reported"))
    return {
      stage: "needs_action",
      message: "Confirm or dispute a reported payment",
    };
  if (
    email === split.organizer &&
    Object.values(split.responses).some((r) => r.status === "correction")
  )
    return { stage: "needs_action", message: "Review requested corrections" };
  if (split.responses[email]?.status === "correction")
    return {
      stage: "waiting",
      message: "Waiting for the organizer to review your correction",
    };
  if (
    split.repayments.some(
      (p) => (p.from === email || p.to === email) && p.status === "disputed",
    )
  )
    return {
      stage: "needs_action",
      message: "Review a disputed transfer in payment history",
    };
  if (split.expense.mode === "planned") {
    if (!split.responses[email])
      return {
        stage: "needs_action",
        message: "Review and accept or decline participation",
      };
    if (Object.values(split.responses).some((r) => r.status === "declined"))
      return {
        stage: email === split.organizer ? "needs_action" : "waiting",
        message: "Resolve declined participation before proceeding",
      };
    if (split.expense.participants.some((p) => !split.responses[p.email]))
      return {
        stage: "waiting",
        message: "Waiting for explicit participant responses",
      };
    return { stage: "ready", message: "Participation agreed" };
  }
  const claim = claimState(split);
  if (claim !== "agreed") {
    if (claim === "disputed") return { stage: "needs_action", message: "Disputed claim — review the reasons and propose a resolution" };
    if (email !== split.organizer && split.responses[email]?.status !== "accepted")
      return { stage: "needs_action", message: "Review the claimed cost and accept or dispute your share" };
    return { stage: "waiting", message: "Waiting for everyone to confirm the claimed cost" };
  }
  const remaining = balances(split);
  const balance = remaining[email] ?? 0;
  if (split.repayments.some((p) => p.from === email && p.status === "reported"))
    return {
      stage: "waiting",
      message: "Waiting for the recipient to confirm your transfer",
    };
  if (balance > 0)
    return {
      stage: "needs_action",
      message: "Repay a payer and report the transfer",
    };
  if (balance < 0)
    return { stage: "waiting", message: "Waiting for repayments" };
  if (
    Object.values(remaining).some((n) => n !== 0) ||
    split.repayments.some((p) => p.status !== "confirmed")
  )
    return {
      stage: "waiting",
      message:
        "Your balance is settled; other participants are still resolving the split",
    };
  return { stage: "settled", message: "Your balance is settled" };
}
export function nextAction(split: Split, email: string) {
  return splitState(split, email).message;
}
