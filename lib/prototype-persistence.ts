"use client";

import { initialState } from "@/lib/demo-data";
import type { AppState, ParticipantStatus, Proposal } from "@/lib/types";

export const SPLITFLOW_STORAGE_KEY = "splitflow.demoState.v2";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDemoState(): AppState {
  if (!canUseStorage()) return initialState;
  const saved = window.localStorage.getItem(SPLITFLOW_STORAGE_KEY);
  if (!saved) return initialState;

  try {
    return { ...initialState, ...JSON.parse(saved) } as AppState;
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
  if (canUseStorage()) window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify(initialState));
  return initialState;
}
