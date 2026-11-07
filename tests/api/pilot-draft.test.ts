import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/pilot/draft/route";
import { callSplitAgent } from "@/lib/ai/openai";
vi.mock("@/lib/ai/openai", () => ({ callSplitAgent: vi.fn() }));
describe("pilot optional drafting", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://pilot.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              id: "actor",
              email: "a@example.com",
              email_confirmed_at: "today",
            }),
          ),
        ),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });
  const request = () =>
    new NextRequest("http://localhost/api/pilot/draft", {
      method: "POST",
      headers: { Authorization: "Bearer session" },
      body: JSON.stringify({
        message: "Dinner paid by A",
        participants: [
          { name: "A", email: "a@example.com", paid: 0 },
          { name: "B", email: "b@example.com", paid: 0 },
        ],
      }),
    });
  it("keeps AI provider errors and secrets out of recovery messages", async () => {
    vi.mocked(callSplitAgent).mockRejectedValue(
      new Error("secret provider output"),
    );
    const result = await POST(request());
    expect(result.status).toBe(503);
    const body = await result.text();
    expect(body).toContain("description is retained");
    expect(body).not.toContain("secret");
  });
  it("ignores model share amounts and validates item totals with deterministic logic", async () => {
    vi.mocked(callSplitAgent).mockResolvedValue({
      assistantMessage: "",
      intent: "draft_proposal",
      agentUpdates: [],
      proposalDraft: {
        title: "Dinner",
        description: "",
        totalCost: 60001,
        currency: "KRW",
        splitMethod: "equal",
        costItems: [{ label: "Dinner", amount: 60001, paidBy: "A" }],
        participants: [
          { name: "A", shareAmount: 1 },
          { name: "B", shareAmount: 60000 },
        ],
        fairnessNote: "",
        recommendation: "",
      },
    });
    const result = await POST(request());
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.participants[0].paid).toBe(60001);
    expect(body.participants[0].shareAmount).toBeUndefined();
  });
});
