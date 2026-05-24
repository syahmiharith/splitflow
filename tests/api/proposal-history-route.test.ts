import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { GET as getHistory } from "@/app/api/workflow/proposals/[proposalId]/history/route";
import type { AgentRun, ArtifactRecord } from "@/lib/types";
import { FileWorkflowRepository } from "@/lib/workflow/file-workflow-repository";
import type { ProposalHistoryResult } from "@/lib/workflow/schema";

const originalStateFile = process.env.SPLITFLOW_STATE_FILE;

function stateFile() {
  return path.join(process.cwd(), ".splitflow", `test-history-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

function request(proposalId = "han-river-bbq-proposal") {
  return new Request(`http://localhost/api/workflow/proposals/${proposalId}/history?groupId=han-river-bbq`);
}

async function payload(response: Response) {
  return (await response.json()) as ProposalHistoryResult;
}

describe("/api/workflow/proposals/[proposalId]/history", () => {
  beforeEach(() => {
    process.env.SPLITFLOW_STATE_FILE = stateFile();
  });

  afterEach(() => {
    process.env.SPLITFLOW_STATE_FILE = originalStateFile;
  });

  it("returns proposal versions in immutable chain order", async () => {
    const response = await getHistory(request(), { params: Promise.resolve({ proposalId: "han-river-bbq-proposal" }) });
    const history = await payload(response);

    expect(response.status).toBe(200);
    expect(history.proposalRecord.id).toBe("han-river-bbq-proposal");
    expect(history.versions.map((version) => version.version)).toEqual([1]);
    expect(history.versions[0]).toMatchObject({
      transitionType: "draft_created",
      reason: "Seeded canonical demo proposal.",
      amountChanges: 0
    });
  });

  it("includes active and superseded artifacts while normalizing old staged records", async () => {
    const repository = new FileWorkflowRepository(process.env.SPLITFLOW_STATE_FILE);
    const state = await repository.read();
    const active = state.artifactRecords.find((record) => record.proposalId === "han-river-bbq-proposal");
    expect(active).toBeDefined();
    const oldRecord: ArtifactRecord = {
      ...active!,
      id: `${active!.id}-old`,
      state: "superseded",
      supersededByArtifactId: active!.id,
      createdAt: "2026-01-01T00:00:00.000Z",
      artifact: {
        ...active!.artifact,
        id: `${active!.artifact.id}-old`,
        title: `Old ${active!.artifact.title}`,
        state: "staged"
      }
    };
    await repository.write({ ...state, artifactRecords: [oldRecord, ...state.artifactRecords] });

    const response = await getHistory(request(), { params: Promise.resolve({ proposalId: "han-river-bbq-proposal" }) });
    const history = await payload(response);

    expect(history.artifacts.some((artifact) => artifact.active && artifact.state === "review_required")).toBe(true);
    expect(history.artifacts.some((artifact) => artifact.id === oldRecord.id && artifact.state === "superseded" && !artifact.active)).toBe(true);
  });

  it("sanitizes failed run timeline details", async () => {
    const repository = new FileWorkflowRepository(process.env.SPLITFLOW_STATE_FILE);
    const state = await repository.read();
    const run: AgentRun = {
      id: "unsafe-run",
      groupId: "han-river-bbq",
      chatId: "chat-han-river-bbq",
      sourceMessageId: "unsafe-source",
      sourceMessage: "contains private organizer text",
      status: "failed",
      retryCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:00:01.000Z",
      error: "SECRET OPENAI_API_KEY leaked",
      eventIds: ["event-version", "event-failed"],
      events: [
        {
          id: "event-version",
          runId: "unsafe-run",
          at: "2026-01-01T00:00:00.500Z",
          type: "proposal_version_created",
          proposalId: "han-river-bbq-proposal",
          proposalVersionId: "han-river-bbq-proposal-v1",
          version: 1,
          detail: "Created immutable proposal v1."
        },
        {
          id: "event-failed",
          runId: "unsafe-run",
          at: "2026-01-01T00:00:01.000Z",
          type: "run_failed",
          detail: "SECRET OPENAI_API_KEY leaked"
        }
      ]
    };
    await repository.write({ ...state, runs: [run, ...state.runs] });

    const response = await getHistory(request(), { params: Promise.resolve({ proposalId: "han-river-bbq-proposal" }) });
    const text = JSON.stringify(await response.json());

    expect(text).toContain("Workflow run failed safely.");
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("private organizer text");
  });
});
