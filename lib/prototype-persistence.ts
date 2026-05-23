"use client";

import { defaultGroup, initialState } from "@/lib/demo-data";
import { deriveGroupAnalytics } from "@/lib/analytics";
import { recalculateProposal } from "@/lib/prototype-proposals";
import type { AgentRun, AppState, ChatSession, ParticipantStatus, Proposal, SplitFlowGroup } from "@/lib/types";

export const SPLITFLOW_STORAGE_KEY = "splitflow.demoState.v4";
export const CURRENT_SCHEMA_VERSION = 5;
const STALE_STORAGE_KEYS = ["splitflow.demoState.v1", "splitflow.demoState.v2", "splitflow.demoState.v3"];

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDemoState(): AppState {
  if (!canUseStorage()) return initialState;
  clearStaleStorageKeys();
  const saved = window.localStorage.getItem(SPLITFLOW_STORAGE_KEY);
  if (!saved) return initialState;

  try {
    return normalizePersistedState(JSON.parse(saved));
  } catch {
    return initialState;
  }
}

export function saveDemoState(state: AppState): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    SPLITFLOW_STORAGE_KEY,
    JSON.stringify({
      ...state,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      migrationLog: Array.isArray(state.migrationLog) ? state.migrationLog : []
    })
  );
}

export function getProposals(): Proposal[] {
  return getDemoState().groups.flatMap((group) => group.proposals);
}

export function getProposalById(id: string): Proposal | undefined {
  return getProposals().find((proposal) => proposal.id === id);
}

export function saveProposal(proposal: Proposal): void {
  const state = getDemoState();
  const targetGroupId = proposal.groupId ?? state.selectedGroupId ?? defaultGroup.id;
  const groups = state.groups.map((group) => {
    if (group.id !== targetGroupId) return group;
    const nextProposal = { ...proposal, groupId: group.id };
    const exists = group.proposals.some((item) => item.id === nextProposal.id);
    return {
      ...group,
      proposals: exists ? group.proposals.map((item) => (item.id === nextProposal.id ? nextProposal : item)) : [nextProposal, ...group.proposals],
      updatedAt: new Date().toISOString()
    };
  });
  const proposalGroups = groups.some((group) => group.id === targetGroupId)
    ? groups
    : [{ ...defaultGroup, id: targetGroupId, proposals: [{ ...proposal, groupId: targetGroupId }] }, ...groups];
  saveDemoState(normalizePersistedState({ ...state, selectedGroupId: targetGroupId, groups: proposalGroups }));
}

export function updateParticipantResponse(
  proposalId: string,
  participantId: string,
  response: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes" | "paid" | "disputed">,
  note?: string
): Proposal | undefined {
  const state = getDemoState();
  let updated: Proposal | undefined;
  const groups = state.groups.map((group) => ({
    ...group,
    proposals: group.proposals.map((proposal) => {
      if (proposal.id !== proposalId) return proposal;
      updated = {
        ...proposal,
        participants: proposal.participants.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                status: response,
                changeRequestNote: response === "requested_changes" || response === "disputed" ? note : participant.changeRequestNote,
                lastRespondedAt: new Date().toISOString()
              }
            : participant
        ),
        updatedAt: new Date().toISOString()
      };
      return updated;
    })
  }));
  saveDemoState(normalizePersistedState({ ...state, groups }));
  return updated;
}

export function resetDemoData(): AppState {
  if (canUseStorage()) {
    clearStaleStorageKeys();
    window.localStorage.removeItem(SPLITFLOW_STORAGE_KEY);
    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ ...initialState, schemaVersion: CURRENT_SCHEMA_VERSION }));
  }
  return { ...initialState, schemaVersion: CURRENT_SCHEMA_VERSION };
}

function clearStaleStorageKeys(): void {
  if (!canUseStorage()) return;
  for (const key of STALE_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function normalizePersistedState(value: unknown): AppState {
  if (!isRecord(value)) return initialState;
  const schemaVersion = typeof value.schemaVersion === "number" ? value.schemaVersion : 4;
  if (schemaVersion > CURRENT_SCHEMA_VERSION) return initialState;
  const groups = Array.isArray(value.groups) ? value.groups.map(normalizePersistedGroup).filter((group): group is SplitFlowGroup => Boolean(group)) : [];
  if (groups.length === 0) return initialState;
  const migrationLog = Array.isArray(value.migrationLog) ? value.migrationLog.filter((entry): entry is string => typeof entry === "string") : [];
  const nextMigrationLog =
    schemaVersion === CURRENT_SCHEMA_VERSION
      ? migrationLog
      : [...migrationLog, `Migrated local state from schema v${schemaVersion} to v${CURRENT_SCHEMA_VERSION}.`];

  const selectedGroupId =
    typeof value.selectedGroupId === "string" && groups.some((group) => group.id === value.selectedGroupId)
      ? value.selectedGroupId
      : groups[0]?.id ?? defaultGroup.id;
  const selectedChatIdByGroupId = isRecord(value.selectedChatIdByGroupId) ? (value.selectedChatIdByGroupId as Record<string, string>) : {};
  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? defaultGroup;
  if (!selectedChatIdByGroupId[selectedGroupId] && activeGroup.chats[0]) {
    selectedChatIdByGroupId[selectedGroupId] = activeGroup.chats[0].id;
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migrationLog: nextMigrationLog,
    currentUser: typeof value.currentUser === "string" ? (value.currentUser as AppState["currentUser"]) : initialState.currentUser,
    selectedGroupId,
    selectedChatIdByGroupId,
    groups,
    workspacePanel: null,
    globalNotifications: Array.isArray(value.globalNotifications) ? value.globalNotifications : initialState.globalNotifications,
    agentSteps: Array.isArray(value.agentSteps) ? value.agentSteps : initialState.agentSteps,
    agentRuns: Array.isArray(value.agentRuns) ? value.agentRuns.filter(isAgentRun).slice(-20) : [],
    aiUnavailable: typeof value.aiUnavailable === "boolean" ? value.aiUnavailable : false,
    lastAiError: typeof value.lastAiError === "string" ? value.lastAiError : undefined
  };
}

function normalizePersistedGroup(value: unknown): SplitFlowGroup | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string" || typeof value.name !== "string") return undefined;
  const proposals = Array.isArray(value.proposals) ? value.proposals.map(normalizePersistedProposal).filter((proposal): proposal is Proposal => Boolean(proposal)) : [];
  const members = Array.isArray(value.members) && value.members.length > 0 ? value.members : proposals[0]?.participants;
  const chats = Array.isArray(value.chats) ? value.chats.filter(isChatSession).slice(-3) : [];
  const artifacts = Array.isArray(value.artifacts) ? value.artifacts.filter(isRecord) : [];
  if (!members || members.length === 0) return undefined;

  const group = {
    ...defaultGroup,
    ...value,
    members,
    proposals,
    chats: chats.length > 0 ? chats : defaultGroup.chats,
    artifacts: artifacts.length > 0 ? (artifacts as SplitFlowGroup["artifacts"]) : defaultGroup.artifacts,
    analyticsSummary: defaultGroup.analyticsSummary,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString()
  };

  return { ...group, analyticsSummary: deriveGroupAnalytics(group) };
}

function normalizePersistedProposal(value: unknown): Proposal | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string" || typeof value.title !== "string") return undefined;
  if (!Array.isArray(value.participants) || value.participants.length === 0) return undefined;
  if (!Array.isArray(value.costItems) || value.costItems.length === 0) return undefined;

  try {
    return recalculateProposal({
      ...(value as Proposal),
      version: typeof value.version === "number" ? value.version : 1,
      revisionHistory: Array.isArray(value.revisionHistory) ? value.revisionHistory as Proposal["revisionHistory"] : []
    });
  } catch {
    return undefined;
  }
}

function isChatSession(value: unknown): value is ChatSession {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string" && Array.isArray(value.messages);
}

function isAgentRun(value: unknown): value is AgentRun {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.groupId === "string" &&
    typeof value.chatId === "string" &&
    typeof value.sourceMessageId === "string" &&
    (value.status === "running" || value.status === "completed" || value.status === "failed") &&
    Array.isArray(value.events)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
