import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/route";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalRuntimeFlag = process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK;

function request(body: unknown) {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/agent", () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK = originalRuntimeFlag;
  });

  it("calls orchestrator and returns structured response", async () => {
    const response = await POST(request({ type: "user_message", message: "Split a ₩120,000 dinner equally between 4 people." }));
    const payload = (await response.json()) as {
      message: string;
      proposal?: unknown;
      nextActions: string[];
      trace: Array<{ action: string }>;
      runtime?: { backend: string; openAiAgentsSdk: { envFlagEnabled: boolean; apiKeyPresent: boolean; runtimeCreated: boolean } };
    };
    expect(response.status).toBe(200);
    expect(payload.message).toContain("Drafted");
    expect(payload.proposal).toBeDefined();
    expect(payload.nextActions.length).toBeGreaterThan(0);
    expect(payload.trace.length).toBeGreaterThan(0);
    expect(payload.trace.map((step) => step.action)).toContain("check_openai_agents_sdk");
    expect(payload.trace.map((step) => step.action)).not.toContain("server_workflow_step");
    expect(payload.runtime).toMatchObject({
      backend: "runOrchestrator",
      openAiAgentsSdk: {
        envFlagEnabled: false,
        runtimeCreated: false
      }
    });
  });

  it("validates bad input", async () => {
    const response = await POST(request({ type: "user_message", message: "" }));
    expect(response.status).toBe(400);
  });

  it("does not expose secrets", async () => {
    process.env.OPENAI_API_KEY = "test-secret";
    delete process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK;
    const response = await POST(request({ type: "user_message", message: "Split a ₩120,000 dinner equally between 4 people." }));
    const text = await response.text();
    expect(text).not.toContain("test-secret");
    expect(text).not.toContain("OPENAI_API_KEY");
  });

  it("rejects specialized-agent bypass attempts", async () => {
    const response = await POST(request({ type: "direct_agent_call", agentName: "Intake Agent" }));
    const payload = (await response.json()) as { runtime?: { backend: string } };
    expect(response.status).toBe(400);
    expect(payload.runtime?.backend).toBe("runOrchestrator");
  });

  it("handles orchestrator errors safely", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(
      request({
        type: "participant_response",
        proposalId: "missing",
        participantId: "missing",
        response: "accepted"
      })
    );
    spy.mockRestore();
    const payload = (await response.json()) as { message: string };
    expect(response.status).toBe(200);
    expect(payload.message).toBe("Proposal was not found.");
  });
});
