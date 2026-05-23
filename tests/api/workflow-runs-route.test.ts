import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { POST as createRun } from "@/app/api/agent/runs/route";
import { GET as getEvents } from "@/app/api/agent/runs/[runId]/events/route";
import { POST as retryRun } from "@/app/api/agent/runs/[runId]/retry/route";

const originalStateFile = process.env.SPLITFLOW_STATE_FILE;

function request(body: unknown) {
  return new Request("http://localhost/api/agent/runs", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/agent/runs", () => {
  beforeEach(() => {
    process.env.SPLITFLOW_STATE_FILE = path.join(process.cwd(), ".splitflow", `test-api-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  });

  afterEach(() => {
    process.env.SPLITFLOW_STATE_FILE = originalStateFile;
  });

  it("creates or reuses a run by idempotency key", async () => {
    const body = {
      groupId: "jeju-trip",
      chatId: "chat-jeju-intake",
      message: "Split 120,000 won dinner between 4 people.",
      idempotencyKey: "api-run-key"
    };

    const first = await createRun(request(body));
    const second = await createRun(request(body));
    const firstPayload = (await first.json()) as { run: { id: string } };
    const secondPayload = (await second.json()) as { run: { id: string } };

    expect(first.status).toBe(200);
    expect(secondPayload.run.id).toBe(firstPayload.run.id);
  });

  it("replays persisted run events as server-sent events", async () => {
    const response = await createRun(
      request({
        groupId: "jeju-trip",
        chatId: "chat-jeju-intake",
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
    expect(text).toContain("event: run_completed");
  });

  it("retries an existing run with a new attempt", async () => {
    const response = await createRun(
      request({
        groupId: "jeju-trip",
        chatId: "chat-jeju-intake",
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
