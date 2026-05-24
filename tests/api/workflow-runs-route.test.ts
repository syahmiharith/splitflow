import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { POST as createRun } from "@/app/api/agent/runs/route";
import { GET as getRun } from "@/app/api/agent/runs/[runId]/route";
import { GET as getEvents } from "@/app/api/agent/runs/[runId]/events/route";
import { POST as retryRun } from "@/app/api/agent/runs/[runId]/retry/route";

const originalStateFile = process.env.SPLITFLOW_STATE_FILE;
const originalWorkflowExecutionMode = process.env.SPLITFLOW_WORKFLOW_EXECUTION_MODE;

function request(body: unknown) {
  return new Request("http://localhost/api/agent/runs", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/agent/runs", () => {
  beforeEach(() => {
    process.env.SPLITFLOW_STATE_FILE = path.join(process.cwd(), ".splitflow", `test-api-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    delete process.env.SPLITFLOW_WORKFLOW_EXECUTION_MODE;
  });

  afterEach(() => {
    process.env.SPLITFLOW_STATE_FILE = originalStateFile;
    process.env.SPLITFLOW_WORKFLOW_EXECUTION_MODE = originalWorkflowExecutionMode;
  });

  it("creates or reuses a run by idempotency key", async () => {
    const body = {
      groupId: "han-river-bbq",
      chatId: "chat-han-river-bbq",
      message: "Split 120,000 won dinner between 4 people.",
      idempotencyKey: "api-run-key"
    };

    const first = await createRun(request(body));
    const second = await createRun(request(body));
    const firstPayload = (await first.json()) as { run: { id: string; status: string } };
    const secondPayload = (await second.json()) as { run: { id: string } };

    expect(first.status).toBe(200);
    expect(firstPayload.run.status).toBe("running");
    expect(secondPayload.run.id).toBe(firstPayload.run.id);
  });

  it("can execute a run inline for serverless deployments", async () => {
    process.env.SPLITFLOW_WORKFLOW_EXECUTION_MODE = "inline";

    const response = await createRun(
      request({
        groupId: "han-river-bbq",
        chatId: "chat-han-river-bbq",
        message: "Split 120,000 won dinner between 4 people.",
        idempotencyKey: "inline-run-key"
      })
    );
    const payload = (await response.json()) as { run: { id: string; status: string }; proposal?: unknown; assistantMessage?: unknown };

    expect(response.status).toBe(200);
    expect(payload.run.status).toBe("completed");
    expect(payload.proposal).toBeDefined();
    expect(payload.assistantMessage).toBeDefined();
  });

  it("preserves a client-created chat id instead of falling back to the seeded chat", async () => {
    process.env.SPLITFLOW_WORKFLOW_EXECUTION_MODE = "inline";
    const clientChatId = "chat-client-created-123";

    const response = await createRun(
      request({
        groupId: "jeju-trip",
        chatId: clientChatId,
        message: "hi",
        idempotencyKey: "client-chat-run-key"
      })
    );
    const payload = (await response.json()) as {
      run: { status: string; chatId: string };
      group: { chats: Array<{ id: string; messages: Array<{ sender: string; content: string }> }> };
    };
    const preservedChat = payload.group.chats.find((chat) => chat.id === clientChatId);

    expect(response.status).toBe(200);
    expect(payload.run.status).toBe("completed");
    expect(payload.run.chatId).toBe(clientChatId);
    expect(preservedChat).toBeDefined();
    expect(preservedChat?.messages.some((message) => message.sender === "user" && message.content === "hi")).toBe(true);
    expect(preservedChat?.messages.some((message) => message.sender === "bot")).toBe(true);
  });

  it("replays persisted run events as server-sent events", async () => {
    const response = await createRun(
      request({
        groupId: "han-river-bbq",
        chatId: "chat-han-river-bbq",
        message: "Split 120,000 won dinner between 4 people.",
        idempotencyKey: "sse-run-key"
      })
    );
    const payload = (await response.json()) as { run: { id: string } };

    const eventResponse = await getEvents(new Request(`http://localhost/api/agent/runs/${payload.run.id}/events`), {
      params: Promise.resolve({ runId: payload.run.id })
    });
    const text = await eventResponse.text();

    expect(eventResponse.headers.get("Content-Type")).toContain("text/event-stream");
    expect(text).toContain("event: run_started");
    expect(text).toContain("event: text_delta");
    expect(text).toContain("event: run_completed");

    const snapshotResponse = await getRun(new Request(`http://localhost/api/agent/runs/${payload.run.id}`), {
      params: Promise.resolve({ runId: payload.run.id })
    });
    const snapshot = (await snapshotResponse.json()) as { run: { status: string }; proposal?: unknown };
    expect(snapshot.run.status).toBe("completed");
    expect(snapshot.proposal).toBeDefined();
  });

  it("persists terminal failure events without leaking internal details", async () => {
    const response = await createRun(
      request({
        groupId: "han-river-bbq",
        chatId: "chat-han-river-bbq",
        message: "SPLITFLOW_FORCE_RUN_FAILURE",
        idempotencyKey: "failed-run-key"
      })
    );
    const payload = (await response.json()) as { run: { id: string } };

    const eventResponse = await getEvents(new Request(`http://localhost/api/agent/runs/${payload.run.id}/events`), {
      params: Promise.resolve({ runId: payload.run.id })
    });
    const text = await eventResponse.text();

    expect(text).toContain("event: run_failed");
    expect(text).toContain("Workflow run failed safely.");
    expect(text).not.toContain("Forced workflow failure");
  });

  it("retries an existing run with a new attempt", async () => {
    const response = await createRun(
      request({
        groupId: "han-river-bbq",
        chatId: "chat-han-river-bbq",
        message: "Split 120,000 won dinner between 4 people.",
        idempotencyKey: "retry-run-key"
      })
    );
    const payload = (await response.json()) as { run: { id: string } };

    const retryResponse = await retryRun(new Request(`http://localhost/api/agent/runs/${payload.run.id}/retry`, { method: "POST" }), {
      params: Promise.resolve({ runId: payload.run.id })
    });
    const retryPayload = (await retryResponse.json()) as { run: { id: string; retryCount: number } };

    expect(retryResponse.status).toBe(200);
    expect(retryPayload.run.id).toBe(payload.run.id);
    expect(retryPayload.run.retryCount).toBeGreaterThanOrEqual(1);
  });
});
