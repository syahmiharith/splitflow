"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import { deriveGroupAnalytics } from "@/lib/analytics";
import type { Proposal as DomainProposal } from "@/lib/domain/proposal-types";
import { defaultGroup, initialState } from "@/lib/demo-data";
import { createGroupParticipant } from "@/lib/group-participant";
import { countParticipants, deriveProposalStatus } from "@/lib/split";
import { getDemoState, resetDemoData, saveDemoState } from "@/lib/prototype-persistence";
import {
  applyPrototypeAdjustment,
  createBbqProposalFromPrompt,
  createProposalFromPrompt,
  createProposalFromPromptWithAllocation,
  createSettlementLedgerLines,
  loadSubscriptionDemoProposal,
  loadTripDemoProposal,
  recalculateProposal,
  updatePaymentRecordStatus
} from "@/lib/prototype-proposals";
import type {
  AppState,
  Artifact,
  BotMessage,
  ChatSession,
  ParticipantStatus,
  Proposal,
  SplitFlowGroup,
  UserMode
} from "@/lib/types";

const MAX_CHATS_PER_GROUP = 3;

type StoreContextValue = {
  state: AppState;
  activeGroup: SplitFlowGroup;
  activeChat: ChatSession;
  activeProposal: Proposal;
  activeArtifacts: Artifact[];
  selectedArtifact?: Artifact;
  selectedPanelProposal?: Proposal;
  setCurrentUser: (user: UserMode) => void;
  createGroup: (input: { name: string; description?: string; members?: string[] }) => string;
  updateGroup: (groupId: string, input: Partial<Pick<SplitFlowGroup, "name" | "description" | "members">>) => void;
  selectGroup: (groupId: string) => void;
  ensureDefaultGroup: () => void;
  createChat: (groupId?: string) => string;
  selectChat: (chatId: string, groupId?: string) => void;
  recordChatUserMessage: (message: string, groupId?: string) => void;
  setActiveProposal: (proposalId: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  applyAgentResponse: (response: OrchestratorResponse, sourceMessage?: string) => void;
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
  requestReconfirmation: (proposalId?: string) => void;
  markBooked: () => void;
  markPaid: (participantId: string, proposalId?: string) => void;
  markSettled: (proposalId?: string) => void;
  archiveProposal: (proposalId?: string) => void;
  resolveAllocation: (strategy: "single_total_equal_items" | "unallocated_remainder") => void;
  updateCreditStatus: (recordId: string, status: "confirmed" | "disputed" | "void") => void;
  openArtifact: (artifactId: string) => void;
  openProposalPanel: (proposalId: string) => void;
  openGroupSettings: () => void;
  closePanel: () => void;
  loadDemo: (kind: "bbq" | "trip" | "subscription") => void;
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
    messages: [createMessage("bot", "Describe the group expense and I’ll create proposal artifacts for this group.")],
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

function hydrateDerivedState(state: AppState): AppState {
  const groups = state.groups.length > 0 ? state.groups : [defaultGroup];
  const selectedGroupId = state.selectedGroupId && groups.some((group) => group.id === state.selectedGroupId) ? state.selectedGroupId : groups[0].id;
  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const selectedChatIdByGroupId = { ...(state.selectedChatIdByGroupId ?? {}) };
  if (!selectedChatIdByGroupId[selectedGroupId] || !activeGroup.chats.some((chat) => chat.id === selectedChatIdByGroupId[selectedGroupId])) {
    selectedChatIdByGroupId[selectedGroupId] = activeGroup.chats[0]?.id ?? createEmptyChat().id;
  }
  return {
    ...state,
    selectedGroupId,
    selectedChatIdByGroupId,
    groups: groups.map((group) => ({ ...group, analyticsSummary: deriveGroupAnalytics(group) })),
    agentSteps: state.agentSteps.length > 0 ? state.agentSteps : initialState.agentSteps
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

function participantStatusesAfterSend(proposal: Proposal): Proposal {
  return {
    ...proposal,
    status: "waiting_for_responses",
    participants: proposal.participants.map((participant) => ({
      ...participant,
      status: participant.id === proposal.organizerId || participant.id === "you" ? "accepted" : participant.status === "not_sent" ? "pending" : participant.status,
      paymentStatus: participant.id === proposal.organizerId || participant.id === "you" ? "review" : participant.paymentStatus
    })),
    updatedAt: new Date().toISOString()
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
  const workspacePanel = state.workspacePanel;
  const activeArtifacts = activeChat.artifactIds
    .map((artifactId) => activeGroup.artifacts.find((artifact) => artifact.id === artifactId))
    .filter((artifact): artifact is Artifact => Boolean(artifact));
  const selectedArtifact = workspacePanel?.type === "artifact" ? activeGroup.artifacts.find((artifact) => artifact.id === workspacePanel.artifactId) : undefined;
  const selectedPanelProposal =
    workspacePanel?.type === "proposal" ? activeGroup.proposals.find((proposal) => proposal.id === workspacePanel.proposalId) : undefined;

  const setCurrentUser = useCallback((user: UserMode) => {
    setState((current) => ({ ...current, currentUser: user }));
  }, []);

  const createGroup = useCallback((input: { name: string; description?: string; members?: string[] }) => {
    const group = createGroupRecord(input);
    setState((current) =>
      hydrateDerivedState({
        ...current,
        groups: [group, ...current.groups.filter((item) => item.id !== group.id)],
        selectedGroupId: group.id,
        selectedChatIdByGroupId: { ...(current.selectedChatIdByGroupId ?? {}), [group.id]: group.chats[0].id },
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

  const recordChatUserMessage = useCallback((message: string, groupId?: string) => {
    const targetGroupId = groupId ?? activeGroup.id;
    setState((current) => {
      const { activeChat: selectedChat } = selectedIds(current);
      return updateGroup(current, targetGroupId, (group) => appendChatMessage(group, selectedChat.id, createMessage("user", message)));
    });
  }, [activeGroup.id]);

  const setActiveProposal = useCallback((proposalId: string) => {
    setState((current) => ({ ...current, workspacePanel: { type: "proposal", proposalId } }));
  }, []);

  const sendChatMessage = useCallback(async (_message: string) => {
    // useChat owns network transport; group chat persistence is handled by recordChatUserMessage/applyAgentResponse.
  }, []);

  const applyAgentResponse = useCallback((response: OrchestratorResponse, sourceMessage?: string) => {
    setState((current) => {
      const { activeGroup: group, activeChat: chat } = selectedIds(current);
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
            createArtifact("parser_review", `${proposal.title} parser review`, "Review extracted items, participants, payers, exclusions, credits, assumptions, and confidence before sending.", proposal.id, parserDetails),
            createArtifact("proposal_draft", `${proposal.title} proposal`, "Draft proposal created from parsed expense structure.", proposal.id, parserDetails),
            createArtifact("itemized_breakdown", `${proposal.title} itemized math`, "Deterministic itemized calculation and eligibility rules.", proposal.id, proposal.calculationResult?.auditExplanation),
            createArtifact("settlement_plan", `${proposal.title} settlement plan`, "Debtor-to-creditor settlement instructions.", proposal.id, proposal.calculationResult?.settlementInstructions.map((instruction) => instruction.text)),
            createArtifact("settlement_ledger", `${proposal.title} settlement ledger`, "Proof-aware ledger for claimed and confirmed payments.", proposal.id, createSettlementLedgerLines(proposal))
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
          ? `I found a likely split, but need clarification before creating a proposal:\n${parsed.parserResult.clarificationQuestions.map((question) => `- ${question.question}`).join("\n")}`
          : parsed?.parserResult.status === "unsupported"
            ? parsed.parserResult.normalizedSummary
            : response.message;

      return updateGroup(
        {
          ...current,
          workspacePanel: artifacts[0] ? { type: "artifact", artifactId: artifacts[0].id } : current.workspacePanel,
          agentSteps:
            parsed?.parserResult
              ? [
                  { id: "parser-read", name: "Reading expense request", description: "Identified the shared-cost scenario.", status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-items", name: "Extracting items and participants", description: parsed.parserResult.normalizedSummary, status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-rules", name: "Checking exclusions and credits", description: `${parsed.parserResult.draft?.exclusions.length ?? 0} rules and ${parsed.parserResult.draft?.credits.length ?? 0} credits detected.`, status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-validation", name: "Validating totals", description: parsed.parserResult.issues.length > 0 ? parsed.parserResult.issues.map((issue) => issue.message).join(" ") : "No blocking validation issues.", status: "completed", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-engine", name: "Running deterministic split engine", description: proposal ? "Final amounts computed by deterministic TypeScript." : "Waiting for clarification before calculating final amounts.", status: proposal ? "completed" : "pending", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) },
                  { id: "parser-artifact", name: "Creating proposal artifact", description: proposal ? "Proposal artifacts are ready for review." : "No artifact created until clarification is resolved.", status: proposal ? "completed" : "pending", time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()) }
                ]
              : response.trace.length > 0
              ? response.trace.map((step, index) => ({
                  id: `${index}-${step.agent}-${step.action}`,
                  name: step.agent,
                  description: step.detail,
                  status: step.status === "completed" ? "completed" : "pending",
                  time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())
                }))
              : current.agentSteps,
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
    });
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

  const sendProposal = useCallback((proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => appendTimeline(participantStatusesAfterSend(proposal), "Organizer", "Sent proposal to participants for review."));
  }, [updateProposalInActiveGroup]);

  const reviewProposal = useCallback(() => {
    setState((current) => updateGroup(current, activeGroup.id, (group) => appendChatMessage(group, activeChat.id, createMessage("bot", "The proposal artifact is ready for review. Open the right panel to inspect deterministic math.", activeProposal.id))));
  }, [activeChat.id, activeGroup.id, activeProposal.id]);

  const askAiToAdjust = useCallback(() => {
    setState((current) => updateGroup(current, activeGroup.id, (group) => appendChatMessage(group, activeChat.id, createMessage("bot", "Describe the adjustment, for example: Daniel did not eat beef.", activeProposal.id))));
  }, [activeChat.id, activeGroup.id, activeProposal.id]);

  const applyAdjustment = useCallback((prompt: string, proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => {
      const result = applyPrototypeAdjustment(proposal, prompt);
      if (!result.changed) return appendTimeline(proposal, "Organizer", `Adjustment could not be applied automatically: ${prompt}`);
      return appendTimeline(result.proposal, "Organizer", "Applied AI-assisted adjustment after deterministic recalculation.");
    });
  }, [updateProposalInActiveGroup]);

  const respondAsParticipant = useCallback((participantId: string, status: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes">, note?: string, proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => {
      const participants = proposal.participants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              status,
              paymentStatus: status === "accepted" ? ("unpaid" as const) : ("review" as const),
              changeRequestNote: status === "requested_changes" ? note || "Requested a proposal change." : participant.changeRequestNote,
              lastRespondedAt: new Date().toISOString()
            }
          : participant
      );
      const withResponse = appendTimeline(
        { ...proposal, participants, updatedAt: new Date().toISOString() },
        proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId,
        status === "accepted" ? "Accepted the proposal." : status === "opted_out" ? "Opted out of the proposal." : `Requested change: ${note ?? "No note provided."}`
      );
      if (status !== "opted_out") return updateStatusFromParticipants(withResponse);
      return recalculateProposal(
        {
          ...withResponse,
          costItems: withResponse.costItems.map((item) => ({
            ...item,
            excludedParticipantIds: Array.from(new Set([...(item.excludedParticipantIds ?? []), participantId]))
          })),
          status: "recalculation_needed"
        },
        "Participant opted out; recalculation is required."
      );
    });
  }, [updateProposalInActiveGroup]);

  const acceptRequestedChange = useCallback((proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => {
      const requested = proposal.participants.find((participant) => participant.status === "requested_changes" && participant.changeRequestNote);
      const recalculated = requested ? applyPrototypeAdjustment(proposal, requested.changeRequestNote ?? "") : { proposal, changed: false };
      const next = recalculated.changed ? recalculated.proposal : recalculateProposal(proposal, "Reviewed requested change.");
      return appendTimeline(
        {
          ...next,
          status: "needs_reconfirmation",
          participants: next.participants.map((participant) =>
            participant.status === "accepted" || participant.status === "requested_changes"
              ? { ...participant, status: "needs_reconfirmation", paymentStatus: "review", changeRequestNote: undefined }
              : participant
          )
        },
        "Organizer",
        "Accepted requested change and requested reconfirmation."
      );
    });
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
    updateProposalInActiveGroup(proposalId, (proposal) => {
      const participants = proposal.participants.map((participant) =>
        participant.id === participantId ? { ...participant, status: "paid" as const, paymentStatus: "paid" as const } : participant
      );
      const allPaid = participants
        .filter((participant) => participant.status !== "opted_out")
        .every((participant) => participant.paymentStatus === "paid" || participant.id === proposal.organizerId || participant.id === "you");
      return appendTimeline({ ...proposal, participants, status: allPaid ? "settled" : "partially_paid" }, "Organizer", "Marked participant as paid.");
    });
  }, [updateProposalInActiveGroup]);

  const markSettled = useCallback((proposalId?: string) => {
    updateProposalInActiveGroup(proposalId, (proposal) => appendTimeline({ ...proposal, status: "settled" }, "Organizer", "Marked proposal settled."));
  }, [updateProposalInActiveGroup]);

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
        createArtifact("parser_review", `${proposal.title} parser review`, "Allocation was resolved by organizer choice before deterministic calculation.", proposal.id, [
          parserResult.normalizedSummary,
          `Allocation: ${strategy}`,
          ...(parserResult.draft?.assumptions ?? []).map((assumption) => `Assumption: ${assumption}`)
        ]),
        createArtifact("proposal_draft", `${proposal.title} proposal`, "Draft proposal created after allocation resolution.", proposal.id),
        createArtifact("settlement_ledger", `${proposal.title} settlement ledger`, "Proof-aware ledger for claimed and confirmed payments.", proposal.id, createSettlementLedgerLines(proposal))
      ];
      return updateGroup({ ...current, workspacePanel: { type: "artifact", artifactId: artifacts[0].id } }, group.id, (currentGroup) => {
        let nextGroup = upsertProposal(currentGroup, proposal);
        nextGroup = appendChatMessage(nextGroup, chat.id, createMessage("bot", `Resolved allocation using ${strategy.replaceAll("_", " ")}. Deterministic proposal artifacts are ready.`, proposal.id));
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

  const loadDemo = useCallback((kind: "bbq" | "trip" | "subscription") => {
    const proposal =
      kind === "trip"
        ? loadTripDemoProposal()
        : kind === "subscription"
          ? loadSubscriptionDemoProposal()
          : createBbqProposalFromPrompt("BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef.") ?? defaultGroup.proposals[0];
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
      setCurrentUser,
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
      sendProposal,
      reviewProposal,
      askAiToAdjust,
      respondAsParticipant,
      applyAdjustment,
      acceptRequestedChange,
      requestReconfirmation,
      markBooked,
      markPaid,
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
      setCurrentUser,
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
      sendProposal,
      reviewProposal,
      askAiToAdjust,
      respondAsParticipant,
      applyAdjustment,
      acceptRequestedChange,
      requestReconfirmation,
      markBooked,
      markPaid,
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
