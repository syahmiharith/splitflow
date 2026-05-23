import { describe, expect, it } from "vitest";
import path from "node:path";
import { FileWorkflowRepository } from "@/lib/workflow/file-workflow-repository";
import { applyWorkflowAction, listRunEvents, runWorkflow } from "@/lib/workflow/workflow-service";

function stateFile(name: string) {
  return path.join(process.cwd(), ".splitflow", `test-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

describe("file-backed workflow repository", () => {
  it("seeds, persists, and reloads server state", async () => {
    const filePath = stateFile("seed");
    const repository = new FileWorkflowRepository(filePath);

    const seeded = await repository.read();
    const reloaded = await new FileWorkflowRepository(filePath).read();

    expect(seeded.schemaVersion).toBe(1);
    expect(reloaded.groups[0].id).toBe("jeju-trip");
    expect(reloaded.proposalRecords[0].currentVersionId).toBe("jeju-airbnb-trip-v1");
  });

  it("creates idempotent runs with persisted events and proposal versions", async () => {
    const repository = new FileWorkflowRepository(stateFile("run"));
    const request = {
      groupId: "jeju-trip",
      chatId: "chat-jeju-intake",
      message: "Dinner was 120,000 won for 4 people.",
      idempotencyKey: "same-run-key"
    };

    const first = await runWorkflow(request, repository);
    const second = await runWorkflow(request, repository);
    const events = await listRunEvents(first.run.id, undefined, repository);
    const state = await repository.read();

    expect(second.run.id).toBe(first.run.id);
    expect(events.map((event) => event.type)).toContain("proposal_version_created");
    expect(state.proposalVersions.some((version) => version.transitionType === "draft_created")).toBe(true);
  });

  it("keeps immutable versions and supersedes artifacts after an accepted change", async () => {
    const repository = new FileWorkflowRepository(stateFile("versions"));
    await applyWorkflowAction(
      {
        type: "participant_response",
        groupId: "jeju-trip",
        chatId: "chat-jeju-intake",
        proposalId: "jeju-airbnb-trip",
        participantId: "alex",
        status: "requested_changes",
        note: "Alex is only joining Saturday night.",
        idempotencyKey: "alex-change"
      },
      repository
    );
    const accepted = await applyWorkflowAction(
      {
        type: "accept_change",
        groupId: "jeju-trip",
        chatId: "chat-jeju-intake",
        proposalId: "jeju-airbnb-trip",
        idempotencyKey: "accept-alex-change"
      },
      repository
    );
    const state = await repository.read();
    const record = state.proposalRecords.find((item) => item.id === "jeju-airbnb-trip");
    const firstVersion = state.proposalVersions.find((version) => version.id === "jeju-airbnb-trip-v1");
    const activeSummary = state.artifactRecords.find((recordItem) => recordItem.kind === "change_request_summary" && recordItem.state === "active");

    expect(record?.versionIds.length).toBeGreaterThanOrEqual(3);
    expect(firstVersion?.proposal.version).toBe(1);
    expect(accepted.proposal?.status).toBe("needs_reconfirmation");
    expect(activeSummary?.proposalVersionId).toBe(`jeju-airbnb-trip-v${accepted.proposal?.version}`);
  });
});
