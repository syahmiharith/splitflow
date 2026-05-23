import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/split-agent/route";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModelEnv = {
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_MODEL_CHEAP: process.env.OPENAI_MODEL_CHEAP,
  OPENAI_MODEL_DEFAULT: process.env.OPENAI_MODEL_DEFAULT,
  OPENAI_MODEL_ADVANCED: process.env.OPENAI_MODEL_ADVANCED
};

function restoreEnv(name: keyof typeof originalModelEnv) {
  const value = originalModelEnv[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function request(body: unknown) {
  return new Request("http://localhost/api/ai/split-agent", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/ai/split-agent", () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    restoreEnv("OPENAI_MODEL");
    restoreEnv("OPENAI_MODEL_CHEAP");
    restoreEnv("OPENAI_MODEL_DEFAULT");
    restoreEnv("OPENAI_MODEL_ADVANCED");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 503 when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(request({ message: "Create a split" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("X-SplitFlow-Route-Status")).toBe("deprecated");
    expect(response.headers.get("X-SplitFlow-Replacement")).toBe("/api/agent");
  });

  it("rejects invalid request payload", async () => {
    const response = await POST(request({ message: "" }));
    expect(response.status).toBe(400);
  });

  it("returns structured AI data on mocked success", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({
            assistantMessage: "I created a proposal.",
            intent: "draft_proposal",
            proposalDraft: null,
            agentUpdates: []
          })
        })
      )
    );

    const response = await POST(request({ message: "Create a split" }));
    const payload = (await response.json()) as { data?: { assistantMessage: string } };
    expect(response.status).toBe(200);
    expect(payload.data?.assistantMessage).toBe("I created a proposal.");
  });

  it("uses routed model tiers for OpenAI requests", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL_CHEAP = "cheap-from-env";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model?: string };
      expect(body.model).toBe("cheap-from-env");
      return Response.json({
        output_text: JSON.stringify({
          assistantMessage: "Reminder drafted.",
          intent: "send_reminder",
          proposalDraft: null,
          agentUpdates: []
        })
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ message: "Send a short reminder to Mina.", context: { totalCost: 40000 } }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed AI output", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ output_text: "{\"bad\": true}" })));
    const response = await POST(request({ message: "Create a split" }));
    expect(response.status).toBe(502);
  });
});
