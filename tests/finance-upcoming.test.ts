import { describe, expect, it } from "vitest";
import { nextOccurrence, type FinanceState } from "@/lib/finance/model";
const schedule = (values: Partial<FinanceState["schedules"][number]> = {}): FinanceState["schedules"][number] => ({ id: "rent", name: "Rent", accountId: "bank", amount: 10000, kind: "expense", start: "2026-01-31", frequency: "monthly", paused: false, occurrences: {}, ...values });
describe("deterministic upcoming occurrences", () => {
  it("keeps overdue unhandled occurrences visible instead of skipping to the future", () => {
    expect(nextOccurrence(schedule(), "2026-11-10")).toEqual({ date: "2026-01-31", status: "overdue" });
  });
  it("skips recorded and explicitly skipped periods without month-end drift", () => {
    const s = schedule({ occurrences: { "2026-01-31": "transaction-a" } });
    expect(nextOccurrence(s, "2026-02-01")).toEqual({ date: "2026-02-28", status: "upcoming" });
    s.occurrences["2026-02-28"] = "skipped";
    expect(nextOccurrence(s, "2026-03-31")).toEqual({ date: "2026-03-31", status: "due" });
  });
  it("handles weekly year boundaries, pause and resume", () => {
    const s = schedule({ frequency: "weekly", start: "2026-12-28", occurrences: { "2026-12-28": "skipped" }, paused: true });
    expect(nextOccurrence(s, "2027-01-01")).toBeNull();
    s.paused = false;
    expect(nextOccurrence(s, "2027-01-01")).toEqual({ date: "2027-01-04", status: "upcoming" });
  });
  it("restores leap day in leap years after clamping other years", () => {
    const s = schedule({ frequency: "yearly", start: "2024-02-29", occurrences: { "2024-02-29": "done" } });
    expect(nextOccurrence(s, "2025-01-01")?.date).toBe("2025-02-28");
    s.occurrences = { ...s.occurrences, "2025-02-28": "done", "2026-02-28": "skipped", "2027-02-28": "done" };
    expect(nextOccurrence(s, "2028-01-01")?.date).toBe("2028-02-29");
  });
  it("does not turn expected occurrences into transactions or mutate history", () => {
    const s = schedule(); const before = structuredClone(s);
    nextOccurrence(s, "2026-11-10");
    expect(s).toEqual(before);
  });
});
