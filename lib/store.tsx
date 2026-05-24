"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import { deriveGroupAnalytics } from "@/lib/analytics";
import type { Proposal as DomainProposal } from "@/lib/domain/proposal-types";
import { defaultGroup, initialState } from "@/lib/demo-data";
import { createGroupParticipant } from "@/lib/group-participant";
import { getDemoState, resetDemoData, saveDemoState } from "@/lib/prototype-persistence";
import {
  applyPrototypeAdjustment,
  createProposalFromPrompt,
  createProposalFromPromptWithAllocation,
  createSettlementLedgerLines,
  loadSubscriptionDemoProposal,
  loadTripDemoProposal,
  recalculateProposal,
  updatePaymentRecordStatus
} from "@/lib/prototype-proposals";
import type {
  AgentRun,
  AgentRunContext,
  AgentRunEvent,
  AppState,
  Artifact,
  BotMessage,
  ChatSession,
  ParticipantStatus,
  PaymentRecord,
  Proposal,
  SplitFlowGroup,
  UserMode
} from "@/lib/types";
import type { WorkflowActionResult, WorkflowRunResult } from "@/lib/workflow/schema";

const MAX_CHATS_PER_GROUP = 3;

type StoreContextValue = {
  state: AppState;
  activeGroup: SplitFlowGroup;
  activeChat: ChatSession;
  activeProposal: Proposal;
  activeArtifacts: Artifact[];
  selectedArtifact?: Artifact;
  selectedPanelProposal?: Proposal;
  selectedProfile?: SplitFlowGroup["members"][number];
  setCurrentUser: (user: UserMode) => void;
  setSelectedProfile: (groupId: string, participantId: string) => void;
  createGroup: (input: { name: string; description?: string; members?: string[] }) => string;
  updateGroup: (groupId: string, input: Partial<Pick<SplitFlowGroup, "name" | "description" | "members">>) => void;
  selectGroup: (groupId: string) => void;
  ensureDefaultGroup: () => void;
  createChat: (groupId?: string) => string;
  selectChat: (chatId: string, groupId?: string) => void;
  recordChatUserMessage: (message: string, context?: AgentRunContext) => void;
  setActiveProposal: (proposalId: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  applyAgentResponse: (response: OrchestratorResponse, sourceMessage?: string, context?: AgentRunContext, result?: WorkflowRunResult) => void;
  applyAgentRunEvent: (event: AgentRunEvent) => void;
  failAgentRun: (runId: string, error: string) => void;
  sendProposal: (proposalId?: string) => void;
  reviewProposal: () => void;
  askAiToAdjust: () => void;
  respondAsParticipant: (
    participantId: string,
    status: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes">,
    note?: string,
    proposalId?: string
  ) => void;
  applyAdjustment: (prompt: string, proposalId?: string) => void;
  acceptRequestedChange: (proposalId?: string) => void;
  rejectRequestedChange: (proposalId?: string) => void;
  requestReconfirmation: (proposalId?: string) => void;
  markBooked: () => void;
  markPaid: (participantId: string, proposalId?: string) => void;
  claimParticipantPayment: (participantId: string, proposalId?: string, note?: string) => void;
  markSettled: (proposalId?: string) => void;
  archiveProposal: (proposalId?: string) => void;
  resolveAllocation: (strategy: "single_total_equal_items" | "unallocated_remainder") => void;
  updateCreditStatus: (recordId: string, status: "confirmed" | "disputed" | "void") => void;
  openArtifact: (artifactId: string) => void;
  openProposalPanel: (proposalId: string) => void;
  openGroupSettings: () => void;
  closePanel: () => void;
  loadDemo: (kind: "trip" | "subscription") => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function createMessage(sender: BotMessage["sender"], content: string, relatedProposalId?: string): BotMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    content,
    createdAt: new Date().toISOString(),
    relatedProposalId
  };
}

function createRunEvent(runId: string, type: AgentRunEvent["type"], detail: string, extra?: Partial<AgentRunEvent>): AgentRunEvent {
  return {
    id: crypto.randomUUID(),
    runId,
    at: new Date().toISOString(),
    type,
    detail,
    ...extra
  } as AgentRunEvent;
}

function createAgentRun(context: AgentRunContext, sourceMessageId: string): AgentRun {
  const started = createRunEvent(context.runId, "run_started", "Organizer message sent to the SplitFlow workflow.");
  return {
    id: context.runId,
    groupId: context.groupId,
    chatId: context.chatId,
    sourceMessageId,
    status: "running",
    retryCount: 0,
    createdAt: started.at,
    startedAt: started.at,
    eventIds: [started.id],
    events: [started]
  };
}

function completeAgentRun(run: AgentRun, response: OrchestratorResponse, artifacts: Artifact[]): AgentRun {
  const traceEvents = response.trace.map((step) =>
    createRunEvent(run.id, "step_completed", step.detail, { step: step.agent })
  );
  const artifactEvents = artifacts.map((artifact) =>
    createRunEvent(run.id, "artifact_staged", `Staged ${artifact.title}.`, { artifactId: artifact.id })
  );
  const completed = createRunEvent(run.id, "run_completed", "SplitFlow workflow response applied to the originating chat.");
  const events = [...run.events, ...traceEvents, ...artifactEvents, completed];
  return {
    ...run,
    status: "completed",
    endedAt: completed.at,
    eventIds: events.map((event) => event.id),
    events
  };
}

function failRun(run: AgentRun, error: string): AgentRun {
  const failed = createRunEvent(run.id, "run_failed", error);
  const events = [...run.events, failed];
  return {
    ...run,
    status: "failed",
    endedAt: failed.at,
    error,
    eventIds: events.map((event) => event.id),
    events
  };
}

function applyRunEvent(run: AgentRun, event: AgentRunEvent): AgentRun {
  if (run.events.some((item) => item.id === event.id)) return run;
  const events = [...run.events, event];
  return {
    ...run,
    status: event.type === "run_completed" ? "completed" : event.type === "run_failed" ? "failed" : run.status,
    endedAt: event.type === "run_completed" || event.type === "run_failed" ? event.at : run.endedAt,
    error: event.type === "run_failed" ? event.detail : run.error,
    eventIds: events.map((item) => item.id),
    events
  };
}

function createArtifact(type: Artifact["type"], title: string, summary: string, proposalId?: string, details?: string[], sourceText?: string): Artifact {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    summary,
    proposalId,
    details,
    sourceText,
    createdAt: new Date().toISOString()
  };
}

function createEmptyChat(title = "New chat"): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    messages: [createMessage("bot", "Describe the shared cost, who needs to agree, exclusions, claimed payments, and what must be decided before anyone fronts money.")],
    artifactIds: [],
    createdAt: now,
    updatedAt: now
  };
}

function createGroupRecord(input: { name: string; description?: string; members?: string[] }): SplitFlowGroup {
  const now = new Date().toISOString();
  const chat = createEmptyChat(`${input.name} intake`);
  const memberNames = input.members?.length ? input.members : ["Syahmi", "Ali", "Sarah"];
  return {
    id: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID(),
    name: input.name,
    description: input.description?.trim() || "Shared-cost workspace",
    members: memberNames.map((member, index) => createGroupParticipant(member, index, { isCurrentUser: index === 0 })),
    proposals: [],
    chats: [chat],
    artifacts: [],
    analyticsSummary: { activeProposals: 0, openChangeRequests: 0, pendingSettlements: 0, totalFronted: 0, stillOwed: 0, pendingResponses: 0, confirmedPayments: 0, claimedUnconfirmedCredits: 0 },
    createdAt: now,
    updatedAt: now
  };
}

function normalizeAgentProposal(proposal: DomainProposal, previous: Proposal, groupId: string): Proposal {
  const normalized: Proposal = {
    ...previous,
    id: proposal.id,
    groupId,
    title: proposal.title,
    description: proposal.fairnessExplanation,
    organizerName: proposal.organizerName,
    totalCost: proposal.totalAmount,
    currency: proposal.currency,
    splitMethod: proposal.splitMethod === "weighted" ? "unit_based" : proposal.splitMethod === "equal" ? "equal" : "custom",
    costItems: proposal.items.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount,
      paidByParticipantId: previous.organizerId ?? "you"
    })),
    participants: proposal.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      status:
        participant.responseStatus === "requested_change"
          ? "requested_changes"
          : participant.responseStatus === "reconfirmation_required"
            ? "needs_reconfirmation"
            : participant.responseStatus,
      paymentStatus: participant.paymentStatus === "not_applicable" ? "review" : participant.paymentStatus,
      shareAmount: participant.amountOwed,
      units: participant.weight,
      customAmount: participant.fixedAmount,
      roleNote: participant.metadata ? Object.entries(participant.metadata).map(([key, value]) => `${key}: ${value}`).join(", ") : undefined,
      changeRequestNote: participant.responseNote
    })),
    status:
      proposal.status === "change_requested"
        ? "changes_requested"
        : proposal.status === "reconfirmation_required"
          ? "needs_reconfirmation"
          : proposal.status === "ready_to_pay"
            ? "safe_to_book"
            : proposal.status === "sent" || proposal.status === "partially_accepted"
              ? "waiting_for_responses"
              : "draft",
    fairnessNote: proposal.fairnessExplanation,
    recommendation: proposal.requiredConfirmations.join(" ") || previous.recommendation,
    updatedAt: new Date().toISOString()
  };

  try {
    return recalculateProposal(normalized, "Imported orchestrator proposal into deterministic prototype store.");
  } catch {
    return normalized;
  }
}

function appendTimeline(proposal: Proposal, actor: string, text: string): Proposal {
  return {
    ...proposal,
    timeline: [...(proposal.timeline ?? []), { id: crypto.randomUUID(), at: new Date().toISOString(), actor, text }],
    updatedAt: new Date().toISOString()
  };
}

function markProposalSentLocally(proposal: Proposal): Proposal {
  return appendTimeline(
    {
      ...proposal,
      status: "waiting_for_responses",
      participants: proposal.participants.map((participant) => {
        const isOrganizer = participant.id === proposal.organizerId || participant.id === "you";
        if (isOrganizer) {
          return {
            ...participant,
            status: participant.status === "not_sent" ? ("accepted" as const) : participant.status,
            paymentStatus: participant.paymentStatus === "remind" ? ("review" as const) : participant.paymentStatus
          };
        }
        return {
          ...participant,
          status: participant.status === "not_sent" ? ("pending" as const) : participant.status,
          paymentStatus: participant.paymentStatus === "review" ? participant.paymentStatus : ("remind" as const)
        };
      })
    },
    "Organizer",
    "Sent proposal to participants for agreement."
  );
}

function defaultProfileIdForGroup(group: SplitFlowGroup): string {
  const organizerId = group.proposals.find((proposal) => proposal.organizerId)?.organizerId;
  if (organizerId && group.members.some((member) => member.id === organizerId)) return organizerId;
  const explicitOrganizer = group.members.find((member) => member.id === "you");
  return explicitOrganizer?.id ?? group.members[0]?.id ?? "you";
}

function normalizeSelectedProfiles(groups: SplitFlowGroup[], selectedProfileByGroupId: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    groups.map((group) => {
      const selected = selectedProfileByGroupId[group.id];
      const valid = selected && group.members.some((member) => member.id === selected);
      return [group.id, valid ? selected : defaultProfileIdForGroup(group)];
    })
  );
}

function hydrateDerivedState(state: AppState): AppState {
  const groups = state.groups.length > 0 ? state.groups : [defaultGroup];
  const selectedGroupId = state.selectedGroupId && groups.some((group) => group.id === state.selectedGroupId) ? state.selectedGroupId : groups[0].id;
  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const selectedChatIdByGroupId = { ...(state.selectedChatIdByGroupId ?? {}) };
  if (!selectedChatIdByGroupId[selectedGroupId] || !activeGroup.chats.some((chat) => chat.id === selectedChatIdByGroupId[selectedGroupId])) {
    selectedChatIdByGroupId[selectedGroupId] = activeGroup.chats[0]?.id ?? createEmptyChat().id;
  }
  const selectedProfileByGroupId = normalizeSelectedProfiles(
    groups,
    state.selectedProfileByGroupId ?? (state.currentUser ? { [selectedGroupId]: state.currentUser } : {})
  );
  return {
    ...state,
    schemaVersion: state.schemaVersion ?? initialState.schemaVersion,
    migrationLog: state.migrationLog ?? [],
    selectedGroupId,
    selectedChatIdByGroupId,
    selectedProfileByGroupId,
    currentUser: selectedProfileByGroupId[selectedGroupId] ?? state.currentUser,
    groups: groups.map((group) => ({ ...group, analyticsSummary: deriveGroupAnalytics(group) })),
    agentSteps: state.agentSteps.length > 0 ? state.agentSteps : initialState.agentSteps,
    agentRuns: state.agentRuns ?? []
  };
}

function updateGroup(state: AppState, groupId: string, updater: (group: SplitFlowGroup) => SplitFlowGroup): AppState {
  const groups = state.groups.map((group) => {
    if (group.id !== groupId) return group;
    const updated = updater(group);
    return { ...updated, analyticsSummary: deriveGroupAnalytics(updated), updatedAt: new Date().toISOString() };
  });
  return hydrateDerivedState({ ...state, groups });
}

function upsertProposal(group: SplitFlowGroup, proposal: Proposal): SplitFlowGroup {
  const nextProposal = { ...proposal, groupId: group.id };
  const exists = group.proposals.some((item) => item.id === nextProposal.id);
  return {
    ...group,
    members: nextProposal.participants.length > 0 ? nextProposal.participants : group.members,
    proposals: exists ? group.proposals.map((item) => (item.id === nextProposal.id ? nextProposal : item)) : [nextProposal, ...group.proposals]
  };
}

function appendChatMessage(group: SplitFlowGroup, chatId: string, message: BotMessage): SplitFlowGroup {
  return {
    ...group,
    chats: group.chats.map((chat) =>
      chat.id === chatId ? { ...chat, messages: [...chat.messages, message], updatedAt: new Date().toISOString() } : chat
    )
  };
}

function appendArtifactsToChat(group: SplitFlowGroup, chatId: string, artifacts: Artifact[]): SplitFlowGroup {
  const replacementTypes = new Set(artifacts.map((artifact) => artifact.type));
  const replacedArtifactIds = new Set(group.artifacts.filter((artifact) => replacementTypes.has(artifact.type)).map((artifact) => artifact.id));
  return {
    ...group,
    artifacts: [
      ...artifacts,
      ...group.artifacts.filter(
        (artifact) => !artifacts.some((item) => item.id === artifact.id || (item.proposalId === artifact.proposalId && item.type === artifact.type))
      )
    ],
    chats: group.chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            artifactIds: Array.from(new Set([...artifacts.map((artifact) => artifact.id), ...chat.artifactIds.filter((artifactId) => !replacedArtifactIds.has(artifactId))])),
            updatedAt: new Date().toISOString()
          }
        : chat
    )
  };
}

function selectedIds(state: AppState) {
  const activeGroup = state.groups.find((group) => group.id === state.selectedGroupId) ?? state.groups[0] ?? defaultGroup;
  const chatId = state.selectedChatIdByGroupId?.[activeGroup.id] ?? activeGroup.chats[0]?.id;
  const activeChat = activeGroup.chats.find((chat) => chat.id === chatId) ?? activeGroup.chats[0] ?? defaultGroup.chats[0];
  return { activeGroup, activeChat };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(hydrateDerivedState(getDemoState()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDemoState(state);
  }, [hydrated, state]);

  const derived = useMemo(() => selectedIds(state), [state]);
  const activeGroup = derived.activeGroup;
  const activeChat = derived.activeChat;
  const activeProposal = activeGroup.proposals[0] ?? defaultGroup.proposals[0];
  const selectedProfileId = state.selectedProfileByGroupId?.[activeGroup.id] ?? defaultProfileIdForGroup(activeGroup);
  const selectedProfile = activeGroup.members.find((member) => member.id === selectedProfileId) ?? activeGroup.members[0];
  const workspacePanel = state.workspacePanel;
  const activeArtifacts = activeChat.artifactIds
    .map((artifactId) => activeGroup.artifacts.find((artifact) => artifact.id === artifactId))
    .filter((artifact): artifact is Artifact => Boolean(artifact));
  const selectedArtifact = workspacePanel?.type === "artifact" ? activeGroup.artifacts.find((artifact) => artifact.id === workspacePanel.artifactId) : undefined;
  const selectedPanelProposal =
    workspacePanel?.type === "proposal" ? activeGroup.proposals.find((proposal) => proposal.id === workspacePanel.proposalId) : undefined;

  const setCurrentUser = useCallback((user: UserMode) => {
    setState((current) => {
      const { activeGroup: group } = selectedIds(current);
      return hydrateDerivedState({
        ...current,
        currentUser: user,
        selectedProfileByGroupId: { ...(current.selectedProfileByGroupId ?? {}), [group.id]: user }
      });
    });
  }, []);

  const setSelectedProfile = useCallback((groupId: string, participantId: string) => {
    setState((current) =>
      hydrateDerivedState({
        ...current,
        currentUser: current.selectedGroupId === groupId ? participantId : current.currentUser,
        selectedProfileByGroupId: { ...(current.selectedProfileByGroupId ?? {}), [groupId]: participantId }
      })
    );
  }, []);

  const createGroup = useCallback((input: { name: string; description?: string; members?: string[] }) => {
    const group = createGroupRecord(input);
    setState((current) =>
      hydrateDerivedState({
        ...current,
        groups: [group, ...current.groups.filter((item) => item.id !== group.id)],
        selectedGroupId: group.id,
        selectedChatIdByGroupId: { ...(current.selectedChatIdByGroupId ?? {}), [group.id]: group.chats[0].id },
        selectedProfileByGroupId: { ...(current.selectedProfileByGroupId ?? {}), [group.id]: defaultProfileIdForGroup(group) },
        workspacePanel: null
      })
    );
    return group.id;
  }, []);

  const updateGroupAction = useCallback((groupId: string, input: Partial<Pick<SplitFlowGroup, "name" | "description" | "members">>) => {
    setState((current) => updateGroup(current, groupId, (group) => ({ ...group, ...input })));
  }, []);

  const selectGroup = useCallback((groupId: string) => {
    setState((current) => hydrateDerivedState({ ...current, selectedGroupId: groupId, workspacePanel: null }));
  }, []);

  const ensureDefaultGroup = useCallback(() => {
    setState((current) => (current.groups.length > 0 ? current : hydrateDerivedState({ ...current, groups: [defaultGroup], selectedGroupId: defaultGroup.id })));
  }, []);

  const createChat = useCallback((groupId?: string) => {
    const chat = createEmptyChat();
    const targetGroupId = groupId ?? activeGroup.id;
    setState((current) => {
      const withChat = updateGroup(current, targetGroupId, (group) => ({
        ...group,
        chats: [...group.chats, chat].slice(-MAX_CHATS_PER_GROUP)
      }));
      return hydrateDerivedState({
        ...withChat,
        selectedGroupId: targetGroupId,
        selectedChatIdByGroupId: { ...(withChat.selectedChatIdByGroupId ?? {}), [targetGroupId]: chat.id },
        workspacePanel: null
      });
    });
    return chat.id;
  }, [activeGroup.id]);

  const selectChat = useCallback((chatId: string, groupId?: string) => {
    const targetGroupId = groupId ?? activeGroup.id;
    setState((current) =>
      hydrateDerivedState({
        ...current,
        selectedGroupId: targetGroupId,
        selectedChatIdByGroupId: { ...(current.selectedChatIdByGroupId ?? {}), [targetGroupId]: chatId },
        workspacePanel: null
      })
    );
  }, [activeGroup.id]);

  const recordChatUserMessage = useCallback((message: string, context?: AgentRunContext) => {
    const targetGroupId = context?.groupId ?? activeGroup.id;
    setState((current) => {
      const group = current.groups.find((item) => item.id === targetGroupId);
      const targetChatId = context?.chatId ?? group?.chats[0]?.id ?? selectedIds(current).activeChat.id;
      const userMessage = createMessage("user", message);
      const nextState = updateGroup(current, targetGroupId, (currentGroup) => appendChatMessage(currentGroup, targetChatId, userMessage));
      if (!context) return nextState;
      return {
        ...nextState,
        agentRuns: [createAgentRun(context, userMessage.id), ...(nextState.agentRuns ?? [])].slice(0, 20)
      };
    });
  }, [activeGroup.id]);

  const setActiveProposal = useCallback((proposalId: string) => {
    setState((current) => ({ ...current, workspacePanel: { type: "proposal", proposalId } }));
  }, []);

  const sendChatMessage = useCallback(async (_message: string) => {
    // useChat owns network transport; group chat persistence is handled by recordChatUserMessage/applyAgentResponse.
  }, []);

  const applyAgentResponse = useCallback((response: OrchestratorResponse, sourceMessage?: string, context?: AgentRunContext, result?: WorkflowRunResult) => {
    setState((current) => {
      const currentWithRun = result?.run
        ? hydrateDerivedState({
            ...current,
            workspacePanel: current.workspacePanel,
            agentRuns: [result.run, ...(current.agentRuns ?? []).filter((run) => run.id !== result.run.id)].slice(0, 20),
            agentSteps:
              result.run.events.filter((event) => event.type === "step_completed").length > 0
                ? result.run.events
                    .filter((event) => event.type === "step_completed")
                    .map((event) => ({
                      id: event.id,
                      name: event.step,
                      description: event.detail,
                      status: "completed" as const,
                      time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.at))
                    }))
                : current.agentSteps,
            aiUnavailable: false,
            lastAiError: undefined
          })
        : current;

      if (result?.group) {
        const targetChatId = context?.chatId;
        const serverHasTargetChat = targetChatId ? result.group.chats.some((chat) => chat.id === targetChatId) : true;
        if (serverHasTargetChat && !sourceMessage) {
          const groups = currentWithRun.groups.some((group) => group.id === result.group.id)
            ? currentWithRun.groups.map((group) => (group.id === result.group.id ? result.group : group))
            : [result.group, ...currentWithRun.groups];
          return hydrateDerivedState({
            ...currentWithRun,
            selectedGroupId: currentWithRun.selectedGroupId,
            groups,
            workspacePanel: currentWithRun.workspacePanel
          });
        }
      }
      const fallback = selectedIds(currentWithRun);
      const group = context?.groupId ? currentWithRun.groups.find((item) => item.id === context.groupId) ?? fallback.activeGroup : fallback.activeGroup;
      const chat = context?.chatId ? group.chats.find((item) => item.id === context.chatId) ?? fallback.activeChat : fallback.activeChat;
      const previous = group.proposals[0] ?? defaultGroup.proposals[0];
      const parsed = sourceMessage ? createProposalFromPrompt(sourceMessage, group.id) : undefined;
      const adjusted = !parsed?.proposal && sourceMessage ? applyPrototypeAdjustment(previous, sourceMessage) : undefined;
      const proposal =
        parsed?.proposal ? { ...parsed.proposal, groupId: group.id } :
        adjusted?.changed ? { ...appendTimeline(adjusted.proposal, "Organizer", "Applied chat adjustment through deterministic recalculation."), groupId: group.id } :
        response.proposal ? normalizeAgentProposal(response.proposal, previous, group.id) :
        undefined;
      const parserDetails = parsed?.parserResult.draft
        ? [
            `Mode: ${parsed.parserResult.mode}`,
            `Confidence: ${parsed.parserResult.confidence}`,
            parsed.parserResult.normalizedSummary,
            `Detected total: ${parsed.parserResult.draft.statedTotal ? `₩${parsed.parserResult.draft.statedTotal.toLocaleString("ko-KR")}` : "item total only"}`,
            `Detected items: ${parsed.parserResult.draft.items.map((item) => `${item.label} ${item.amount ? `₩${item.amount.toLocaleString("ko-KR")}` : "missing amount"}`).join(", ")}`,
            `Detected participants: ${parsed.parserResult.draft.participants.map((participant) => participant.name).join(", ")}`,
            `Detected payers: ${parsed.parserResult.draft.payers.map((payer) => `${payer.name}${payer.amount ? ` ₩${payer.amount.toLocaleString("ko-KR")}` : payer.paysRest ? " rest" : ""}`).join(", ")}`,
            ...parsed.parserResult.draft.assumptions.map((assumption) => `Assumption: ${assumption}`),
            ...parsed.parserResult.issues.map((issue) => `${issue.severity === "blocking" ? "Needs clarification" : "Warning"}: ${issue.message}`),
            ...parsed.parserResult.draft.exclusions.map((exclusion) => `Rule: ${exclusion.participantName} excluded from ${exclusion.itemLabel ?? exclusion.onlyIncludedItemLabel ?? "the split"}.`),
            ...parsed.parserResult.draft.credits.map((credit) => `Credit: ${credit.note}`)
          ]
        : [];
      const artifacts = proposal
        ? [
            createArtifact("parser_review", `${proposal.title} split details`, "Review extracted costs, friends, payers, exclusions, credits, assumptions, and confidence before sending.", proposal.id, parserDetails),
            createArtifact("proposal_draft", `${proposal.title}`, "Ready for organizer review: total, itemized costs, exclusions, claimed payments, risk notes, and deterministic math.", proposal.id, parserDetails),
            createArtifact("itemized_breakdown", `${proposal.title} split math`, "Deterministic itemized calculation and who is included in each cost.", proposal.id, proposal.calculationResult?.auditExplanation),
            createArtifact("settlement_plan", `${proposal.title} ready check`, "Shows who should pay whom and whether settlement is ready.", proposal.id, proposal.calculationResult?.settlementInstructions?.map((instruction) => instruction.text)),
            createArtifact("settlement_ledger", `${proposal.title} payment notes`, "Proof-aware notes for claimed and confirmed payments.", proposal.id, createSettlementLedgerLines(proposal))
          ]
        : parsed?.parserResult.issues.some((issue) => issue.code === "allocation_required")
          ? [
              createArtifact(
                "allocation_resolution",
                "Allocation resolution needed",
                "Some item amounts are missing, and a participant rule depends on item-level allocation.",
                undefined,
                [
                  parsed.parserResult.normalizedSummary,
                  "Options: use equal item allocation, enter item amounts manually, or combine as one shared item.",
                  ...parserDetails
                ],
                sourceMessage
              )
            ]
        : [];
      const parserReply =
        parsed?.parserResult.status === "needs_clarification"
          ? `I found a likely split, but need clarification before creating a proposal artifact:\n${parsed.parserResult.clarificationQuestions.map((question) => `- ${question.question}`).join("\n")}`
          : parsed?.parserResult.status === "unsupported"
            ? parsed.parserResult.normalizedSummary
            : response.message;

      const completedRunId = context?.runId;
      const nextState = updateGroup(
        {
          ...currentWithRun,
          workspacePanel: currentWithRun.workspacePanel,
          agentSteps:
            parsed?.parserResult
              ? [
                  { id: "parser-read", name: "Reading organizer request", description: "Identified the shared-cost agreement scenario.", status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-items", name: "Extracting items and participants", description: parsed.parserResult.normalizedSummary, status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-rules", name: "Checking exclusions and claimed payments", description: `${parsed.parserResult.draft?.exclusions.length ?? 0} exclusions and ${parsed.parserResult.draft?.credits.length ?? 0} claimed payments detected.`, status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-validation", name: "Validating total against itemized costs", description: parsed.parserResult.issues.length > 0 ? parsed.parserResult.issues.map((issue) => issue.message).join(" ") : "Itemized costs reconcile with the proposal total.", status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-engine", name: "Running deterministic split engine", description: proposal ? "Final amounts computed by deterministic TypeScript." : "Waiting for clarification before calculating final amounts.", status: proposal ? "completed" : "pending", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-artifact", name: "Creating proposal artifact", description: proposal ? "Ready for organizer review." : "No preview created until clarification is resolved.", status: proposal ? "completed" : "pending", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-actions", name: "Preparing human review actions", description: proposal ? "Send proposal, resolve changes, and confirm claimed payments before settlement." : "Human review actions will appear after proposal creation.", status: proposal ? "completed" : "pending", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) }
                ]
              : response.trace.length > 0
              ? response.trace.map((step, index) => ({
                  id: `${index}-${step.agent}-${step.action}`,
                  name: step.agent,
                  description: step.detail,
                  status: step.status === "completed" ? "completed" : "pending",
                  time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())
                }))
              : currentWithRun.agentSteps,
          aiUnavailable: false,
          lastAiError: undefined
        },
        group.id,
        (currentGroup) => {
          let nextGroup = proposal ? upsertProposal(currentGroup, proposal) : currentGroup;
          nextGroup = appendChatMessage(nextGroup, chat.id, createMessage("bot", parserReply, proposal?.id));
          return appendArtifactsToChat(nextGroup, chat.id, artifacts);
        }
      );
      if (!completedRunId) return nextState;
      return {
        ...nextState,
        agentRuns: (nextState.agentRuns ?? []).map((run) => (run.id === completedRunId ? completeAgentRun(run, response, artifacts) : run))
      };
    });
  }, []);

  const applyAgentRunEvent = useCallback((event: AgentRunEvent) => {
    setState((current) => ({
      ...current,
      agentRuns: (current.agentRuns ?? []).map((run) => (run.id === event.runId ? applyRunEvent(run, event) : run))
    }));
  }, []);

  const failAgentRun = useCallback((runId: string, error: string) => {
    setState((current) => ({
      ...current,
      aiUnavailable: true,
      lastAiError: error,
      agentRuns: (current.agentRuns ?? []).map((run) => (run.id === runId ? failRun(run, error) : run))
    }));
  }, []);

  const updateProposalInActiveGroup = useCallback((proposalId: string | undefined, updater: (proposal: Proposal) => Proposal) => {
    setState((current) => {
      const { activeGroup: group } = selectedIds(current);
      const targetId = proposalId ?? group.proposals[0]?.id;
      if (!targetId) return current;
      return updateGroup(current, group.id, (currentGroup) => ({
        ...currentGroup,
        proposals: currentGroup.proposals.map((proposal) => (proposal.id === targetId ? updater(proposal) : proposal))
      }));
    });
  }, []);

  const applyServerAction = useCallback((body: Record<string, unknown>) => {
    void (async () => {
      const response = await fetch("/api/agent/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = (await response.json()) as WorkflowActionResult | { error?: string };
      if (!response.ok || "error" in result) {
        throw new Error("error" in result && result.error ? result.error : "Workflow action failed.");
      }
      const actionResult = result as WorkflowActionResult;
      setState((current) => {
        const groups = current.groups.some((group) => group.id === actionResult.group.id)
          ? current.groups.map((group) => (group.id === actionResult.group.id ? actionResult.group : group))
          : [actionResult.group, ...current.groups];
        const artifactId = actionResult.artifacts[0]?.id;
        return hydrateDerivedState({
          ...current,
          groups,
          workspacePanel: artifactId && current.selectedGroupId === actionResult.group.id ? { type: "artifact", artifactId } : current.workspacePanel,
          aiUnavailable: false,
          lastAiError: undefined
        });
      });
    })().catch((error) => {
      setState((current) => ({
        ...current,
        aiUnavailable: true,
        lastAiError: error instanceof Error ? error.message : "Workflow action failed."
      }));
    });
  }, []);

  const sendProposal = useCallback((proposalId?: string) => {
    const targetId = proposalId ?? activeProposal.id;
    updateProposalInActiveGroup(targetId, (proposal) => markProposalSentLocally(proposal));
  }, [activeProposal.id, updateProposalInActiveGroup]);

  const reviewProposal = useCallback(() => {
    setState((current) => updateGroup(current, activeGroup.id, (group) => appendChatMessage(group, activeChat.id, createMessage("bot", "The proposal artifact is ready. Open the panel to review deterministic amounts, exclusions, claimed payments, and settlement readiness before sending.", activeProposal.id))));
  }, [activeChat.id, activeGroup.id, activeProposal.id]);

  const askAiToAdjust = useCallback(() => {
    setState((current) => updateGroup(current, activeGroup.id, (group) => appendChatMessage(group, activeChat.id, createMessage("bot", "Describe the change, for example: Daniel should be excluded from meat.", activeProposal.id))));
  }, [activeChat.id, activeGroup.id, activeProposal.id]);

  const applyAdjustment = useCallback((prompt: string, proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => {
      const result = applyPrototypeAdjustment(proposal, prompt);
      if (!result.changed) return appendTimeline(proposal, "Organizer", `Adjustment could not be applied automatically: ${prompt}`);
      return appendTimeline(result.proposal, "Organizer", "Applied AI-assisted adjustment after deterministic recalculation.");
    });
  }, [updateProposalInActiveGroup]);

  const respondAsParticipant = useCallback((participantId: string, status: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes">, note?: string, proposalId?: string) => {
    const targetId = proposalId ?? activeProposal.id;
    updateProposalInActiveGroup(targetId, (proposal) =>
      appendTimeline(
        {
          ...proposal,
          status: status === "requested_changes" ? "changes_requested" : status === "opted_out" ? "recalculation_needed" : proposal.status,
          participants: proposal.participants.map((participant) =>
            participant.id === participantId
              ? {
                  ...participant,
                  status,
                  paymentStatus: status === "accepted" ? "unpaid" : "review",
                  changeRequestNote: status === "requested_changes" ? note ?? "Asked for a change." : participant.changeRequestNote,
                  lastRespondedAt: new Date().toISOString()
                }
              : participant
          )
        },
        proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId,
        status === "accepted" ? "Accepted proposal." : status === "opted_out" ? "Opted out." : `Requested change: ${note ?? "No note provided."}`
      )
    );
    applyServerAction({
      type: "participant_response",
      groupId: activeGroup.id,
      chatId: activeChat.id,
      proposalId: targetId,
      participantId,
      status,
      note,
      idempotencyKey: `response:${targetId}:${participantId}:${status}:${note ?? ""}:${crypto.randomUUID()}`
    });
  }, [activeChat.id, activeGroup.id, activeProposal.id, applyServerAction, updateProposalInActiveGroup]);

  const acceptRequestedChange = useCallback((proposalId?: string) => {
    const targetId = proposalId ?? activeProposal.id;
    applyServerAction({
      type: "accept_change",
      groupId: activeGroup.id,
      chatId: activeChat.id,
      proposalId: targetId,
      idempotencyKey: `accept-change:${targetId}`
    });
  }, [activeChat.id, activeGroup.id, activeProposal.id, applyServerAction]);

  const rejectRequestedChange = useCallback((proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) =>
      appendTimeline(
        {
          ...proposal,
          status: "waiting_for_responses",
          participants: proposal.participants.map((participant) =>
            participant.status === "requested_changes"
              ? { ...participant, status: "pending", paymentStatus: "review", changeRequestNote: undefined }
              : participant
          )
        },
        "Organizer",
        "Rejected participant change request; deterministic proposal amounts remain unchanged."
      )
    );
  }, [updateProposalInActiveGroup]);

  const requestReconfirmation = useCallback((proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) =>
      appendTimeline(
        {
          ...proposal,
          status: "needs_reconfirmation",
          participants: proposal.participants.map((participant) =>
            participant.status === "accepted" ? { ...participant, status: "needs_reconfirmation", paymentStatus: "review" } : participant
          )
        },
        "Organizer",
        "Requested participant reconfirmation."
      )
    );
  }, [updateProposalInActiveGroup]);

  const markBooked = useCallback(() => {
    updateProposalInActiveGroup(undefined, (proposal) => appendTimeline({ ...proposal, status: "settling", isBooked: true }, "Organizer", "Marked as booked."));
  }, [updateProposalInActiveGroup]);

  const markPaid = useCallback((participantId: string, proposalId?: string) => {
    const targetId = proposalId ?? activeProposal.id;
    applyServerAction({
      type: "mark_paid",
      groupId: activeGroup.id,
      chatId: activeChat.id,
      proposalId: targetId,
      participantId,
      idempotencyKey: `mark-paid:${targetId}:${participantId}`
    });
  }, [activeChat.id, activeGroup.id, activeProposal.id, applyServerAction]);

  const claimParticipantPayment = useCallback((participantId: string, proposalId?: string, note?: string) => {
    const targetId = proposalId ?? activeProposal.id;
    updateProposalInActiveGroup(targetId, (proposal) => {
      const participant = proposal.participants.find((item) => item.id === participantId);
      if (!participant) return proposal;
      const calculation = proposal.calculationResult;
      const net = calculation?.netBalanceByParticipant?.[participantId] ?? 0;
      const fairShare = calculation?.fairShareByParticipant?.[participantId] ?? participant.shareAmount ?? 0;
      const amount = Math.max(0, net < 0 ? Math.abs(net) : fairShare);
      const organizerId = proposal.organizerId ?? proposal.participants[0]?.id ?? "you";
      const createdAt = new Date().toISOString();
      const proofNote = note?.trim() || "Participant claimed payment in prototype. Needs organizer confirmation.";
      const existingClaim = (proposal.paymentRecords ?? []).find(
        (record) =>
          record.fromParticipantId === participantId &&
          record.toParticipantId === organizerId &&
          record.status === "claimed"
      );
      const paymentRecords: PaymentRecord[] = existingClaim
        ? (proposal.paymentRecords ?? []).map((record) =>
            record.id === existingClaim.id
              ? {
                  ...record,
                  amount: amount || record.amount,
                  status: "claimed",
                  proofType: "reference",
                  proofNote,
                  reference: proofNote,
                  createdAt
                }
              : record
          )
        : [
            ...(proposal.paymentRecords ?? []),
            {
              id: `claim-${proposal.id}-${participantId}-${createdAt.replace(/[^0-9]/g, "")}`,
              groupId: proposal.groupId ?? activeGroup.id,
              proposalId: proposal.id,
              fromParticipantId: participantId,
              toParticipantId: organizerId,
              amount,
              currency: proposal.currency,
              kind: "settlement_payment",
              status: "claimed",
              proofType: "reference",
              proofNote,
              reference: proofNote,
              createdAt,
              sourceText: proofNote
            }
          ];

      return appendTimeline(
        {
          ...proposal,
          paymentRecords,
          participants: proposal.participants.map((item) =>
            item.id === participantId ? { ...item, paymentStatus: "review", lastRespondedAt: createdAt } : item
          ),
          updatedAt: createdAt
        },
        participant.name,
        "Added a payment claim. Needs organizer confirmation; no bank verification in prototype."
      );
    });
  }, [activeGroup.id, activeProposal.id, updateProposalInActiveGroup]);

  const markSettled = useCallback((proposalId?: string) => {
    const targetId = proposalId ?? activeProposal.id;
    applyServerAction({
      type: "mark_settled",
      groupId: activeGroup.id,
      chatId: activeChat.id,
      proposalId: targetId,
      idempotencyKey: `mark-settled:${targetId}`
    });
  }, [activeChat.id, activeGroup.id, activeProposal.id, applyServerAction]);

  const archiveProposal = useCallback((proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => appendTimeline({ ...proposal, status: "archived" }, "Organizer", "Archived proposal."));
  }, [updateProposalInActiveGroup]);

  const resolveAllocation = useCallback((strategy: "single_total_equal_items" | "unallocated_remainder") => {
    setState((current) => {
      const { activeGroup: group, activeChat: chat } = selectedIds(current);
      const panel = current.workspacePanel;
      const artifact = panel?.type === "artifact" ? group.artifacts.find((item) => item.id === panel.artifactId) : undefined;
      if (!artifact?.sourceText) return current;
      const { proposal, parserResult } = createProposalFromPromptWithAllocation(artifact.sourceText, group.id, strategy);
      if (!proposal) return current;
      const artifacts = [
        createArtifact("parser_review", `${proposal.title} split details`, "Allocation was resolved by organizer choice before deterministic calculation.", proposal.id, [
          parserResult.normalizedSummary,
          `Allocation: ${strategy}`,
          ...(parserResult.draft?.assumptions ?? []).map((assumption) => `Assumption: ${assumption}`)
        ]),
        createArtifact("proposal_draft", `${proposal.title}`, "Proposal artifact created after allocation resolution.", proposal.id),
        createArtifact("settlement_ledger", `${proposal.title} payment notes`, "Proof-aware notes for claimed and confirmed payments.", proposal.id, createSettlementLedgerLines(proposal))
      ];
      return updateGroup({ ...current, workspacePanel: { type: "artifact", artifactId: artifacts[0].id } }, group.id, (currentGroup) => {
        let nextGroup = upsertProposal(currentGroup, proposal);
        nextGroup = appendChatMessage(nextGroup, chat.id, createMessage("bot", `Resolved allocation using ${strategy.replaceAll("_", " ")}. The proposal is ready for review.`, proposal.id));
        return appendArtifactsToChat(nextGroup, chat.id, artifacts);
      });
    });
  }, []);

  const updateCreditStatus = useCallback((recordId: string, status: "confirmed" | "disputed" | "void") => {
    setState((current) => {
      const { activeGroup: group } = selectedIds(current);
      return updateGroup(current, group.id, (currentGroup) => ({
        ...currentGroup,
        proposals: currentGroup.proposals.map((proposal) =>
          proposal.paymentRecords?.some((record) => record.id === recordId) ? updatePaymentRecordStatus(proposal, recordId, status) : proposal
        )
      }));
    });
  }, []);

  const openArtifact = useCallback((artifactId: string) => {
    setState((current) => ({ ...current, workspacePanel: { type: "artifact", artifactId } }));
  }, []);

  const openProposalPanel = useCallback((proposalId: string) => {
    setState((current) => ({ ...current, workspacePanel: { type: "proposal", proposalId } }));
  }, []);

  const openGroupSettings = useCallback(() => {
    setState((current) => ({ ...current, workspacePanel: { type: "group_settings" } }));
  }, []);

  const closePanel = useCallback(() => {
    setState((current) => ({ ...current, workspacePanel: null }));
  }, []);

  const loadDemo = useCallback((kind: "trip" | "subscription") => {
    const proposal =
      kind === "trip"
        ? loadTripDemoProposal()
        : loadSubscriptionDemoProposal();
    setState((current) => updateGroup(current, activeGroup.id, (group) => upsertProposal(group, { ...proposal, groupId: group.id })));
  }, [activeGroup.id]);

  const resetDemo = useCallback(() => {
    setState(hydrateDerivedState(resetDemoData()));
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      activeGroup,
      activeChat,
      activeProposal,
      activeArtifacts,
      selectedArtifact,
      selectedPanelProposal,
      selectedProfile,
      setCurrentUser,
      setSelectedProfile,
      createGroup,
      updateGroup: updateGroupAction,
      selectGroup,
      ensureDefaultGroup,
      createChat,
      selectChat,
      recordChatUserMessage,
      setActiveProposal,
      sendChatMessage,
      applyAgentResponse,
      applyAgentRunEvent,
      failAgentRun,
      sendProposal,
      reviewProposal,
      askAiToAdjust,
      respondAsParticipant,
      applyAdjustment,
      acceptRequestedChange,
      rejectRequestedChange,
      requestReconfirmation,
      markBooked,
      markPaid,
      claimParticipantPayment,
      markSettled,
      archiveProposal,
      resolveAllocation,
      updateCreditStatus,
      openArtifact,
      openProposalPanel,
      openGroupSettings,
      closePanel,
      loadDemo,
      resetDemo
    }),
    [
      state,
      activeGroup,
      activeChat,
      activeProposal,
      activeArtifacts,
      selectedArtifact,
      selectedPanelProposal,
      selectedProfile,
      setCurrentUser,
      setSelectedProfile,
      createGroup,
      updateGroupAction,
      selectGroup,
      ensureDefaultGroup,
      createChat,
      selectChat,
      recordChatUserMessage,
      setActiveProposal,
      sendChatMessage,
      applyAgentResponse,
      applyAgentRunEvent,
      failAgentRun,
      sendProposal,
      reviewProposal,
      askAiToAdjust,
      respondAsParticipant,
      applyAdjustment,
      acceptRequestedChange,
      rejectRequestedChange,
      requestReconfirmation,
      markBooked,
      markPaid,
      claimParticipantPayment,
      markSettled,
      archiveProposal,
      resolveAllocation,
      updateCreditStatus,
      openArtifact,
      openProposalPanel,
      openGroupSettings,
      closePanel,
      loadDemo,
      resetDemo
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useSplitFlow() {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useSplitFlow must be used inside StoreProvider.");
  }
  return value;
}
