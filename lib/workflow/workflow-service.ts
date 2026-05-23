import { randomUUID } from "node:crypto";
import { deriveGroupAnalytics } from "@/lib/analytics";
import {
  applyPrototypeAdjustment,
  createProposalFromPrompt,
  createSettlementLedgerLines,
  recalculateProposal
} from "@/lib/prototype-proposals";
import { countParticipants, deriveProposalStatus } from "@/lib/split";
import type { AgentRun, AgentRunEvent, Artifact, BotMessage, Proposal, SplitFlowGroup } from "@/lib/types";
import { FileWorkflowRepository, getWorkflowRepository } from "@/lib/workflow/file-workflow-repository";
import type { WorkflowActionRequest, WorkflowActionResult, WorkflowRunRequest, WorkflowRunResult, WorkflowServerState } from "@/lib/workflow/schema";

function now(): string {
  return new Date().toISOString();
}

function createMessage(sender: BotMessage["sender"], content: string, relatedProposalId?: string, id: string = randomUUID()): BotMessage {
  return { id, sender, content, relatedProposalId, createdAt: now() };
}

function createRunEvent(runId: string, event: { type: AgentRunEvent["type"]; [key: string]: unknown }): AgentRunEvent {
  return { id: randomUUID(), runId, at: now(), ...event } as AgentRunEvent;
}

function appendEvent(run: AgentRun, event: AgentRunEvent): AgentRun {
  const events = [...run.events, event];
  return { ...run, events, eventIds: events.map((item) => item.id) };
}

function appendChatMessage(group: SplitFlowGroup, chatId: string, message: BotMessage): SplitFlowGroup {
  return {
    ...group,
    chats: group.chats.map((chat) =>
      chat.id === chatId ? { ...chat, messages: [...chat.messages, message], updatedAt: now() } : chat
    )
  };
}

function upsertProposal(group: SplitFlowGroup, proposal: Proposal): SplitFlowGroup {
  const nextProposal = { ...proposal, groupId: group.id };
  const exists = group.proposals.some((item) => item.id === proposal.id);
  return {
    ...group,
    members: nextProposal.participants.length > 0 ? nextProposal.participants : group.members,
    proposals: exists ? group.proposals.map((item) => (item.id === proposal.id ? nextProposal : item)) : [nextProposal, ...group.proposals]
  };
}

function artifact(type: Artifact["type"], title: string, summary: string, proposalId?: string, details?: string[], sourceText?: string, proposalVersion?: number): Artifact {
  return {
    id: randomUUID(),
    type,
    title,
    summary,
    proposalId,
    proposalVersion,
    state: "staged",
    details,
    sourceText,
    createdAt: now()
  };
}

function proposalArtifacts(proposal: Proposal, parserDetails: string[] = [], sourceText?: string): Artifact[] {
  const version = proposal.version ?? 1;
  return [
    artifact("parser_review", `${proposal.title} split details`, "Review extracted costs, friends, payers, exclusions, credits, assumptions, and confidence before sending.", proposal.id, parserDetails, sourceText, version),
    artifact("proposal_draft", `${proposal.title}`, "Trip Split preview created from server-side parsed expense details.", proposal.id, parserDetails, sourceText, version),
    artifact("itemized_breakdown", `${proposal.title} split math`, "Deterministic itemized calculation and who is included in each cost.", proposal.id, proposal.calculationResult?.auditExplanation, sourceText, version),
    artifact("settlement_plan", `${proposal.title} ready check`, "Shows who should pay whom and whether booking is ready.", proposal.id, proposal.calculationResult?.settlementInstructions.map((instruction) => instruction.text), sourceText, version),
    artifact("settlement_ledger", `${proposal.title} payment notes`, "Proof-aware notes for claimed and confirmed payments.", proposal.id, createSettlementLedgerLines(proposal), sourceText, version)
  ];
}

function appendArtifacts(state: WorkflowServerState, group: SplitFlowGroup, chatId: string, artifacts: Artifact[], runId?: string): { state: WorkflowServerState; group: SplitFlowGroup } {
  const artifactIds = new Set(artifacts.map((item) => item.id));
  const supersededIds = new Set<string>();
  const existingArtifacts = group.artifacts.map((existing) => {
    const replacement = artifacts.find((item) => item.proposalId && item.proposalId === existing.proposalId && item.type === existing.type && existing.state !== "superseded");
    if (!replacement) return existing;
    supersededIds.add(existing.id);
    replacement.supersedesArtifactId = existing.id;
    return { ...existing, state: "superseded" as const };
  });
  const nextGroup = {
    ...group,
    artifacts: [...artifacts, ...existingArtifacts.filter((item) => !artifactIds.has(item.id))],
    chats: group.chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            artifactIds: Array.from(new Set([...artifacts.map((item) => item.id), ...chat.artifactIds.filter((id) => !supersededIds.has(id))])),
            updatedAt: now()
          }
        : chat
    )
  };
  const supersededRecords = state.artifactRecords.map((record) => {
    const superseder = artifacts.find((item) => item.supersedesArtifactId === record.id);
    return superseder ? { ...record, state: "superseded" as const, supersededByArtifactId: superseder.id } : record;
  });
  const newRecords = artifacts.map((item) => ({
    id: item.id,
    artifact: item,
    groupId: group.id,
    runId,
    proposalId: item.proposalId,
    proposalVersionId: item.proposalId && item.proposalVersion ? `${item.proposalId}-v${item.proposalVersion}` : undefined,
    kind: item.type,
    state: "active" as const,
    supersedesArtifactId: item.supersedesArtifactId,
    createdAt: item.createdAt
  }));
  return {
    state: { ...state, artifactRecords: [...newRecords, ...supersededRecords] },
    group: nextGroup
  };
}

function updateGroupInState(state: WorkflowServerState, group: SplitFlowGroup): WorkflowServerState {
  const normalized = { ...group, analyticsSummary: deriveGroupAnalytics(group), updatedAt: now() };
  return {
    ...state,
    groups: state.groups.map((item) => (item.id === group.id ? normalized : item))
  };
}

function findGroupAndChat(state: WorkflowServerState, groupId: string, chatId: string): { group: SplitFlowGroup; chatId: string } {
  const group = state.groups.find((item) => item.id === groupId) ?? state.groups[0];
  const chat = group.chats.find((item) => item.id === chatId) ?? group.chats[0];
  return { group, chatId: chat.id };
}

function appendTimeline(proposal: Proposal, actor: string, text: string): Proposal {
  return {
    ...proposal,
    timeline: [...(proposal.timeline ?? []), { id: randomUUID(), at: now(), actor, text }],
    updatedAt: now()
  };
}

function participantStatusesAfterSend(proposal: Proposal): Proposal {
  return {
    ...proposal,
    status: "waiting_for_responses",
    participants: proposal.participants.map((participant) => ({
      ...participant,
      status: participant.id === proposal.organizerId || participant.id === "you" ? "accepted" : participant.status === "not_sent" ? "pending" : participant.status,
      paymentStatus: participant.id === proposal.organizerId || participant.id === "you" ? "review" : participant.paymentStatus
    })),
    updatedAt: now()
  };
}

function updateStatusFromParticipants(proposal: Proposal): Proposal {
  const counts = countParticipants(proposal);
  if (counts.changes > 0) return { ...proposal, status: "changes_requested" };
  if (counts.optedOut > 0) return { ...proposal, status: "recalculation_needed" };
  if (counts.needsReconfirmation > 0) return { ...proposal, status: "needs_reconfirmation" };
  const next = deriveProposalStatus(proposal);
  return { ...proposal, status: next === "waiting_for_responses" && counts.accepted > 0 ? "waiting_for_responses" : next };
}

function participantShare(proposal: Proposal, participantId: string): number {
  return proposal.calculationResult?.fairShareByParticipant[participantId] ?? proposal.participants.find((participant) => participant.id === participantId)?.shareAmount ?? 0;
}

function withRevision(previous: Proposal, next: Proposal, actor: string, reason: string, note?: string): Proposal {
  const previousVersion = previous.version ?? 1;
  const version = previousVersion + 1;
  const amountChanges = previous.participants
    .map((participant) => {
      const nextParticipant = next.participants.find((item) => item.id === participant.id);
      return {
        participantId: participant.id,
        participantName: nextParticipant?.name ?? participant.name,
        beforeAmount: participantShare(previous, participant.id),
        afterAmount: participantShare(next, participant.id)
      };
    })
    .filter((change) => change.beforeAmount !== change.afterAmount);
  return {
    ...next,
    version,
    revisionHistory: [
      ...(previous.revisionHistory ?? []),
      {
        id: randomUUID(),
        version,
        previousVersion,
        createdAt: now(),
        actor,
        reason,
        changeRequestNote: note,
        amountChanges
      }
    ]
  };
}

function revisionArtifact(proposal: Proposal): Artifact | undefined {
  const revision = proposal.revisionHistory?.at(-1);
  if (!revision) return undefined;
  return artifact(
    "change_request_summary",
    `${proposal.title} v${revision.version} change summary`,
    "Records the accepted participant change, affected shares, and reconfirmation requirement.",
    proposal.id,
    [
      `Version: v${revision.previousVersion} -> v${revision.version}`,
      `Reason: ${revision.reason}`,
      ...(revision.changeRequestNote ? [`Participant note: ${revision.changeRequestNote}`] : []),
      ...(revision.amountChanges.length > 0
        ? revision.amountChanges.map((change) => `${change.participantName}: ${change.beforeAmount} -> ${change.afterAmount}`)
        : ["No participant amount changed."])
    ],
    undefined,
    proposal.version
  );
}

function persistProposalTransition(input: {
  repository: FileWorkflowRepository;
  state: WorkflowServerState;
  group: SplitFlowGroup;
  chatId: string;
  previous: Proposal;
  next: Proposal;
  transitionType: "sent" | "participant_response" | "change_accepted" | "paid_marked" | "settled";
  actor: string;
  reason: string;
  artifacts?: Artifact[];
}): { state: WorkflowServerState; group: SplitFlowGroup; proposal: Proposal } {
  const versioned = input.next.version && input.next.version > (input.previous.version ?? 1)
    ? input.next
    : withRevision(input.previous, input.next, input.actor, input.reason);
  let nextState = input.repository.createVersion({
    state: input.state,
    groupId: input.group.id,
    proposal: versioned,
    parentProposal: input.previous,
    transitionType: input.transitionType,
    actor: input.actor,
    reason: input.reason
  });
  let nextGroup = upsertProposal(input.group, versioned);
  if (input.artifacts?.length) {
    const appended = appendArtifacts(nextState, nextGroup, input.chatId, input.artifacts);
    nextState = appended.state;
    nextGroup = appended.group;
  }
  return { state: nextState, group: nextGroup, proposal: versioned };
}

function createRun(request: WorkflowRunRequest): AgentRun {
  const startedAt = now();
  const run: AgentRun = {
    id: request.runId ?? randomUUID(),
    groupId: request.groupId,
    chatId: request.chatId,
    sourceMessageId: request.sourceMessageId ?? randomUUID(),
    sourceMessage: request.message,
    idempotencyKey: request.idempotencyKey,
    status: "running",
    retryCount: request.retryCount ?? 0,
    createdAt: startedAt,
    startedAt,
    eventIds: [],
    events: []
  };
  return appendEvent(run, createRunEvent(run.id, { type: "run_started", detail: "Started server-canonical SplitFlow workflow." }));
}

export async function runWorkflow(request: WorkflowRunRequest, repository: FileWorkflowRepository = getWorkflowRepository()): Promise<WorkflowRunResult> {
  let result: WorkflowRunResult | undefined;
  await repository.update((state) => {
    const existingRunId = state.idempotencyKeys[request.idempotencyKey];
    const existingRun = existingRunId ? state.runs.find((run) => run.id === existingRunId) : undefined;
    if (existingRun) {
      const { group } = findGroupAndChat(state, existingRun.groupId, existingRun.chatId);
      result = {
        run: existingRun,
        group,
        proposal: group.proposals[0],
        artifacts: existingRun.events.flatMap((event) =>
          event.type === "artifact_staged" ? group.artifacts.filter((artifactItem) => artifactItem.id === event.artifactId) : []
        )
      };
      return state;
    }

    let run = createRun(request);
    const { group, chatId } = findGroupAndChat(state, request.groupId, request.chatId);
    let nextGroup = appendChatMessage(group, chatId, createMessage("user", request.message, undefined, run.sourceMessageId));
    run = appendEvent(run, createRunEvent(run.id, { type: "step_started", step: "Intake Agent", detail: "Parsing organizer message on the server." }));
    const parsed = createProposalFromPrompt(request.message, group.id);
    const parserDetails = parsed.parserResult.draft
      ? [
          `Mode: ${parsed.parserResult.mode}`,
          `Confidence: ${parsed.parserResult.confidence}`,
          parsed.parserResult.normalizedSummary,
          ...parsed.parserResult.issues.map((issue) => `${issue.severity === "blocking" ? "Needs clarification" : "Warning"}: ${issue.message}`)
        ]
      : [parsed.parserResult.normalizedSummary];
    run = appendEvent(run, createRunEvent(run.id, { type: "step_completed", step: "Intake Agent", detail: parsed.parserResult.normalizedSummary }));

    let nextState = state;
    let proposal: Proposal | undefined;
    let artifacts: Artifact[] = [];
    let reply = "I need a little more detail before I can create a Trip Split.";

    if (parsed.proposal) {
      run = appendEvent(run, createRunEvent(run.id, { type: "step_started", step: "Split Planning Agent", detail: "Building deterministic split inputs." }));
      proposal = { ...parsed.proposal, groupId: group.id, version: 1, revisionHistory: [] };
      nextState = repository.createVersion({
        state: nextState,
        groupId: group.id,
        proposal,
        transitionType: "draft_created",
        actor: "Organizer",
        reason: "Created proposal from server-side parsed chat message."
      });
      run = appendEvent(run, createRunEvent(run.id, { type: "step_completed", step: "Split Planning Agent", detail: "Prepared deterministic itemized calculation." }));
      run = appendEvent(run, createRunEvent(run.id, { type: "proposal_version_created", proposalId: proposal.id, proposalVersionId: `${proposal.id}-v1`, version: 1, detail: "Created immutable proposal v1." }));
      artifacts = proposalArtifacts(proposal, parserDetails, request.message);
      const appended = appendArtifacts(nextState, upsertProposal(nextGroup, proposal), chatId, artifacts, run.id);
      nextState = appended.state;
      nextGroup = appended.group;
      for (const item of artifacts) {
        run = appendEvent(run, createRunEvent(run.id, { type: "artifact_staged", artifactId: item.id, detail: `Staged ${item.title}.` }));
      }
      reply = `Drafted ${proposal.title}. Review the server-generated proposal artifacts before sending.`;
    } else if (parsed.parserResult.issues.some((issue) => issue.code === "allocation_required")) {
      artifacts = [
        artifact("allocation_resolution", "Allocation resolution needed", "Some item amounts are missing, and a participant rule depends on item-level allocation.", undefined, parserDetails, request.message)
      ];
      const appended = appendArtifacts(nextState, nextGroup, chatId, artifacts, run.id);
      nextState = appended.state;
      nextGroup = appended.group;
      for (const item of artifacts) {
        run = appendEvent(run, createRunEvent(run.id, { type: "artifact_staged", artifactId: item.id, detail: `Staged ${item.title}.` }));
      }
    }

    run = appendEvent(run, createRunEvent(run.id, { type: "step_completed", step: "Proposal Agent", detail: proposal ? "Created proposal and artifacts." : "Waiting for clarification." }));
    run = appendEvent(run, createRunEvent(run.id, { type: "text_delta", delta: reply, detail: "Prepared assistant response." }));
    run = appendEvent(run, createRunEvent(run.id, { type: "run_completed", detail: "Completed server-canonical workflow." }));
    run = { ...run, status: "completed", endedAt: now() };
    const assistantMessage = createMessage("bot", reply, proposal?.id);
    nextGroup = appendChatMessage(nextGroup, chatId, assistantMessage);
    nextState = updateGroupInState(nextState, nextGroup);
    nextState = {
      ...nextState,
      runs: [run, ...nextState.runs.filter((item) => item.id !== run.id)].slice(0, 50),
      idempotencyKeys: { ...nextState.idempotencyKeys, [request.idempotencyKey]: run.id }
    };
    result = { run, group: nextGroup, proposal, artifacts, assistantMessage };
    return nextState;
  });
  if (!result) throw new Error("Workflow run did not produce a result.");
  return result;
}

export async function retryWorkflow(runId: string, repository: FileWorkflowRepository = getWorkflowRepository()): Promise<WorkflowRunResult> {
  const run = await repository.getRun(runId);
  if (!run?.sourceMessage) throw new Error("Run cannot be retried.");
  await repository.update((state) => ({
    ...state,
    runs: state.runs.map((item) =>
      item.id === runId
        ? appendEvent({ ...item, status: "running", retryCount: item.retryCount + 1, error: undefined }, createRunEvent(runId, { type: "run_started", detail: "Retry started." }))
        : item
    )
  }));
  return runWorkflow({
    runId,
    groupId: run.groupId,
    chatId: run.chatId,
    sourceMessageId: run.sourceMessageId,
    message: run.sourceMessage,
    idempotencyKey: `${run.idempotencyKey ?? run.id}:retry:${run.retryCount + 1}`,
    retryCount: run.retryCount + 1
  }, repository);
}

export async function listRunEvents(runId: string, afterEventId?: string, repository: FileWorkflowRepository = getWorkflowRepository()): Promise<AgentRunEvent[]> {
  const run = await repository.getRun(runId);
  if (!run) return [];
  if (!afterEventId) return run.events;
  const index = run.events.findIndex((event) => event.id === afterEventId);
  return index >= 0 ? run.events.slice(index + 1) : run.events;
}

export async function applyWorkflowAction(request: WorkflowActionRequest, repository: FileWorkflowRepository = getWorkflowRepository()): Promise<WorkflowActionResult> {
  let result: WorkflowActionResult | undefined;
  await repository.update((state) => {
    if (state.idempotencyKeys[request.idempotencyKey]) {
      const { group } = findGroupAndChat(state, request.groupId, request.chatId);
      result = { group, proposal: group.proposals.find((proposal) => proposal.id === request.proposalId), artifacts: [] };
      return state;
    }
    const { group, chatId } = findGroupAndChat(state, request.groupId, request.chatId);
    const previous = group.proposals.find((proposal) => proposal.id === request.proposalId);
    if (!previous) {
      result = { group, artifacts: [] };
      return state;
    }

    let next = previous;
    let artifacts: Artifact[] = [];
    let transitionType: "sent" | "participant_response" | "change_accepted" | "paid_marked" | "settled" = "participant_response";
    let reason = "Updated proposal.";
    let actor = "Organizer";

    if (request.type === "send_proposal") {
      next = appendTimeline(participantStatusesAfterSend(previous), "Organizer", "Sent Your Share to friends for review.");
      transitionType = "sent";
      reason = "Organizer sent proposal.";
    } else if (request.type === "participant_response") {
      const participants = previous.participants.map((participant) =>
        participant.id === request.participantId
          ? {
              ...participant,
              status: request.status,
              paymentStatus: request.status === "accepted" ? ("unpaid" as const) : ("review" as const),
              changeRequestNote: request.status === "requested_changes" ? request.note ?? "Asked for a change." : participant.changeRequestNote,
              lastRespondedAt: now()
            }
          : participant
      );
      const withResponse = appendTimeline(
        { ...previous, participants, updatedAt: now() },
        previous.participants.find((participant) => participant.id === request.participantId)?.name ?? request.participantId,
        request.status === "accepted" ? "Tapped I'm In." : request.status === "opted_out" ? "Tapped I'm Out." : `Asked for a change: ${request.note ?? "No note provided."}`
      );
      next = request.status === "opted_out"
        ? recalculateProposal(
            {
              ...withResponse,
              costItems: withResponse.costItems.map((item) => ({
                ...item,
                excludedParticipantIds: Array.from(new Set([...(item.excludedParticipantIds ?? []), request.participantId]))
              })),
              status: "recalculation_needed"
            },
            "Participant opted out; recalculation is required."
          )
        : updateStatusFromParticipants(withResponse);
      actor = previous.participants.find((participant) => participant.id === request.participantId)?.name ?? request.participantId;
      reason = "Participant response recorded.";
    } else if (request.type === "accept_change") {
      const requested = previous.participants.find((participant) => participant.status === "requested_changes" && participant.changeRequestNote);
      const recalculated = requested ? applyPrototypeAdjustment(previous, requested.changeRequestNote ?? "") : { proposal: previous, changed: false };
      const recalculatedProposal = recalculated.changed ? recalculated.proposal : recalculateProposal(previous, "Reviewed requested change.");
      next = withRevision(
        previous,
        appendTimeline(
          {
            ...recalculatedProposal,
            status: "needs_reconfirmation",
            participants: recalculatedProposal.participants.map((participant) =>
              participant.status === "accepted" || participant.status === "requested_changes"
                ? { ...participant, status: "needs_reconfirmation", paymentStatus: "review", changeRequestNote: undefined }
                : participant
            )
          },
          "Organizer",
          "Accepted requested change and requested reconfirmation."
        ),
        "Organizer",
        "Accepted participant change request.",
        requested?.changeRequestNote
      );
      const summary = revisionArtifact(next);
      artifacts = summary ? [summary] : [];
      transitionType = "change_accepted";
      reason = "Accepted participant change request.";
    } else if (request.type === "mark_paid") {
      const participants = previous.participants.map((participant) =>
        participant.id === request.participantId ? { ...participant, status: "paid" as const, paymentStatus: "paid" as const } : participant
      );
      const allPaid = participants
        .filter((participant) => participant.status !== "opted_out")
        .every((participant) => participant.paymentStatus === "paid" || participant.id === previous.organizerId || participant.id === "you");
      next = appendTimeline({ ...previous, participants, status: allPaid ? "settled" : "partially_paid" }, "Organizer", "Marked participant as paid.");
      transitionType = "paid_marked";
      reason = "Organizer marked participant paid.";
    } else if (request.type === "mark_settled") {
      next = appendTimeline({ ...previous, status: "settled" }, "Organizer", "Marked split collected.");
      transitionType = "settled";
      reason = "Organizer marked split collected.";
    }

    const persisted = persistProposalTransition({ repository, state, group, chatId, previous, next, transitionType, actor, reason, artifacts });
    const nextState = updateGroupInState(
      { ...persisted.state, idempotencyKeys: { ...persisted.state.idempotencyKeys, [request.idempotencyKey]: request.proposalId } },
      persisted.group
    );
    result = { group: persisted.group, proposal: persisted.proposal, artifacts };
    return nextState;
  });
  if (!result) throw new Error("Workflow action did not produce a result.");
  return result;
}
