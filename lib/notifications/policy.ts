/** Delivery is a follow-up to a committed action, never evidence of agreement. */
export type DeliveryStatus = "queued" | "sending" | "accepted" | "failed" | "suppressed";
export type ReminderPolicy = { enabled: boolean; muted: boolean; snoozedUntil?: string; stopped: boolean };
export function reminderDates(kind: "invitation" | "obligation", anchor: string): string[] {
  const date = new Date(anchor);
  if (!Number.isFinite(date.getTime())) throw Error("A valid reminder date is required.");
  const offsets = kind === "invitation" ? [3, 6] : [0, 7];
  return offsets.map(days => new Date(date.getTime() + days * 86400000).toISOString());
}
export function canRemind(input: {
  policy: ReminderPolicy; now: string; due: string; sent: number;
  resolved: boolean; revoked: boolean; expired: boolean; disputed: boolean; agreed: boolean;
  kind: "invitation" | "obligation";
}): boolean {
  const { policy } = input;
  return policy.enabled && !policy.muted && !policy.stopped && input.sent < 2 &&
    !input.resolved && !input.revoked && !input.expired && !input.disputed &&
    (input.kind === "invitation" || input.agreed) &&
    Date.parse(input.now) >= Date.parse(input.due) &&
    (!policy.snoozedUntil || Date.parse(input.now) >= Date.parse(policy.snoozedUntil));
}
