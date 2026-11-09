import { describe, expect, it } from "vitest";
import { canRemind, reminderDates } from "@/lib/notifications/policy";
describe("bounded opt-in reminders", () => {
  const input = { policy: { enabled: true, muted: false, stopped: false }, now: "2026-11-10T00:00:00Z", due: "2026-11-09T00:00:00Z", sent: 0, resolved: false, revoked: false, expired: false, disputed: false, agreed: true, kind: "obligation" as const };
  it("uses three-day invitation and due-date obligation schedules", () => {
    expect(reminderDates("invitation", "2026-11-01T00:00:00Z")[0]).toBe("2026-11-04T00:00:00.000Z");
    expect(reminderDates("obligation", "2026-11-01T00:00:00Z")[1]).toBe("2026-11-08T00:00:00.000Z");
  });
  it("suppresses unresolved claims, disputes, revoked and resolved tasks", () => {
    expect(canRemind(input)).toBe(true);
    for (const field of ["resolved", "revoked", "expired", "disputed"] as const) expect(canRemind({ ...input, [field]: true })).toBe(false);
    expect(canRemind({ ...input, agreed: false })).toBe(false);
    expect(canRemind({ ...input, sent: 2 })).toBe(false);
  });
  it("honors opt out, mute and snooze", () => {
    expect(canRemind({ ...input, policy: { ...input.policy, enabled: false } })).toBe(false);
    expect(canRemind({ ...input, policy: { ...input.policy, muted: true } })).toBe(false);
    expect(canRemind({ ...input, policy: { ...input.policy, snoozedUntil: "2026-11-11T00:00:00Z" } })).toBe(false);
  });
});
