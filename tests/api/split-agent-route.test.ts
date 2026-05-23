import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/split-agent/route";

const originalApiKey = process.env.OPENAI_API_KEY;

function request(body: unknown) {
  return new Request("http://localhost/api/ai/split-agent", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/ai/split-agent", () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
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

  it("rejects malformed AI output", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ output_text: "{\"bad\": true}" })));
    const response = await POST(request({ message: "Create a split" }));
    expect(response.status).toBe(502);
  });
});
