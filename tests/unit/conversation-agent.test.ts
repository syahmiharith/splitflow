import { afterEach, describe, expect, it, vi } from "vitest";
import { draftConversation } from "@/lib/pilot/conversation-agent";
const expense = {
  title: "Outing",
  mode: "paid",
  participants: [
    { name: "A", email: "a@example.com", paid: 40001 },
    { name: "B", email: "b@example.com", paid: 20000 },
    { name: "C", email: "c@example.com", paid: 0 },
  ],
  items: [
    {
      name: "Food",
      amount: 60001,
      included: ["a@example.com", "b@example.com"],
      custom: null,
    },
  ],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("conversation provider boundary", () => {
  it("validates excluded people and reconciles a two-payer draft without publishing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              message: "Review your draft.",
              expense,
            }),
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await draftConversation([], null, "a@example.com");
    expect(result.expense?.items[0].included).not.toContain("c@example.com");
    expect(result.expense?.participants[1].paid).toBe(20000);
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.store).toBe(false);
    expect(request.text.format.strict).toBe(true);
  });
  it("rejects a provider draft with inconsistent payer totals", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                message: "Draft",
                expense: {
                  ...expense,
                  participants: expense.participants.map((p) => ({
                    ...p,
                    paid: 0,
                  })),
                },
              }),
            }),
          ),
        ),
    );
    await expect(draftConversation([], null, "a@example.com")).rejects.toThrow(
      "Payer contributions",
    );
  });
  it("requires no provider request when credentials are absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(draftConversation([], null, "a@example.com")).rejects.toThrow(
      "unavailable",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
