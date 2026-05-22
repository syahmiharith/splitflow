"use client";

import { initialState } from "@/lib/demo-data";
import { recalculateProposal } from "@/lib/prototype-proposals";
import type { AppState, ParticipantStatus, Proposal } from "@/lib/types";

export const SPLITFLOW_STORAGE_KEY = "splitflow.demoState.v3";
const STALE_STORAGE_KEYS = ["splitflow.demoState.v1", "splitflow.demoState.v2"];

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
  window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify(state));
}

export function getProposals(): Proposal[] {
  return getDemoState().proposals;
}

export function getProposalById(id: string): Proposal | undefined {
  return getProposals().find((proposal) => proposal.id === id);
}

export function saveProposal(proposal: Proposal): void {
  const state = getDemoState();
  const exists = state.proposals.some((item) => item.id === proposal.id);
  const proposals = exists
    ? state.proposals.map((item) => (item.id === proposal.id ? proposal : item))
    : [proposal, ...state.proposals];
  saveDemoState({ ...state, proposals });
}

export function updateParticipantResponse(
  proposalId: string,
  participantId: string,
  response: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes" | "paid" | "disputed">,
  note?: string
): Proposal | undefined {
  const state = getDemoState();
  let updated: Proposal | undefined;
  const proposals = state.proposals.map((proposal) => {
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
  });
  saveDemoState({ ...state, proposals });
  return updated;
}

export function resetDemoData(): AppState {
  if (canUseStorage()) {
    clearStaleStorageKeys();
    window.localStorage.removeItem(SPLITFLOW_STORAGE_KEY);
    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify(initialState));
  }
  return initialState;
}

function clearStaleStorageKeys(): void {
  if (!canUseStorage()) return;
  for (const key of STALE_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function normalizePersistedState(value: unknown): AppState {
  if (!isRecord(value)) return initialState;
  const proposals = Array.isArray(value.proposals) ? value.proposals.map(normalizePersistedProposal).filter((proposal): proposal is Proposal => Boolean(proposal)) : [];
  if (proposals.length === 0) return initialState;

  return {
    ...initialState,
    ...value,
    proposals,
    messages: Array.isArray(value.messages) ? value.messages : initialState.messages,
    notifications: Array.isArray(value.notifications) ? value.notifications : initialState.notifications,
    agentSteps: Array.isArray(value.agentSteps) ? value.agentSteps : initialState.agentSteps,
    currentUser: typeof value.currentUser === "string" ? (value.currentUser as AppState["currentUser"]) : initialState.currentUser,
    aiUnavailable: typeof value.aiUnavailable === "boolean" ? value.aiUnavailable : false
  } as AppState;
}

function normalizePersistedProposal(value: unknown): Proposal | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string" || typeof value.title !== "string") return undefined;
  if (!Array.isArray(value.participants) || value.participants.length === 0) return undefined;
  if (!Array.isArray(value.costItems) || value.costItems.length === 0) return undefined;

  try {
    return recalculateProposal(value as Proposal);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
