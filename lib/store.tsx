"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AiResponse } from "@/lib/ai/schemas";
import { initialState } from "@/lib/demo-data";
import { applyOptOut, calculateSplit, deriveProposalStatus } from "@/lib/split";
import type { AppState, BotMessage, ParticipantStatus, Proposal, UserMode } from "@/lib/types";

const STORAGE_KEY = "splitflow.demoState.v1";

type StoreContextValue = {
  state: AppState;
  activeProposal: Proposal;
  setCurrentUser: (user: UserMode) => void;
  sendChatMessage: (message: string) => Promise<void>;
  sendProposal: () => void;
  reviewProposal: () => void;
  askAiToAdjust: () => void;
  respondAsParticipant: (participantId: string, status: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes">, note?: string) => void;
  markBooked: () => void;
  markPaid: (participantId: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function loadState(): AppState {
  if (typeof window === "undefined") return initialState;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialState;

  try {
    return { ...initialState, ...JSON.parse(saved) } as AppState;
  } catch {
    return initialState;
  }
}

function createMessage(sender: BotMessage["sender"], content: string, relatedProposalId?: string): BotMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    content,
    createdAt: new Date().toISOString(),
    relatedProposalId
  };
}

function normalizeAiDraft(ai: AiResponse, previous: Proposal): Proposal {
  if (!ai.proposalDraft) return previous;

  const draftParticipants =
    ai.proposalDraft.participants.length > 0
      ? ai.proposalDraft.participants.map((participant, index) => ({
          id: participant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `participant-${index}`,
          name: participant.name,
          status: "pending" as const,
          paymentStatus: "remind" as const,
          shareAmount: participant.shareAmount ?? 0,
          roleNote: participant.roleNote || "Participant"
        }))
      : previous.participants;

  const calculatedParticipants = calculateSplit(
    ai.proposalDraft.totalCost,
    draftParticipants,
    ai.proposalDraft.splitMethod
  );

  return {
    ...previous,
    title: ai.proposalDraft.title,
    description: ai.proposalDraft.description,
    totalCost: ai.proposalDraft.totalCost,
    splitMethod: ai.proposalDraft.splitMethod,
    costItems: ai.proposalDraft.costItems.map((item, index) => ({
      id: `${index}-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: item.label,
      amount: item.amount,
      paidBy: item.paidBy
    })),
    participants: calculatedParticipants,
    fairnessNote: ai.proposalDraft.fairnessNote,
    recommendation: ai.proposalDraft.recommendation,
    status: "draft",
    updatedAt: new Date().toISOString()
  };
}

function updateActiveProposal(state: AppState, updater: (proposal: Proposal) => Proposal): AppState {
  const activeId = state.proposals[0]?.id;
  return {
    ...state,
    proposals: state.proposals.map((proposal) => (proposal.id === activeId ? updater(proposal) : proposal))
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeProposal = state.proposals[0] ?? initialState.proposals[0];

  const setCurrentUser = useCallback((user: UserMode) => {
    setState((current) => ({ ...current, currentUser: user }));
  }, []);

  const sendChatMessage = useCallback(
    async (message: string) => {
      const userMessage = createMessage("user", message);
      setState((current) => ({ ...current, messages: [...current.messages, userMessage], aiUnavailable: false, lastAiError: undefined }));

      try {
        const response = await fetch("/api/ai/split-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            context: {
              activeProposalTitle: activeProposal.title,
              participantNames: activeProposal.participants.map((participant) => participant.name),
              totalCost: activeProposal.totalCost,
              proposalStatus: activeProposal.status
            }
          })
        });

        const payload = (await response.json()) as { data?: AiResponse; error?: string };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error || "AI unavailable.");
        }
        const aiData = payload.data;

        setState((current) =>
          updateActiveProposal(
            {
              ...current,
              messages: [...current.messages, createMessage("bot", aiData.assistantMessage, activeProposal.id)],
              aiUnavailable: false,
              agentSteps:
                aiData.agentUpdates.length > 0
                  ? aiData.agentUpdates.map((step, index) => ({
                      id: `${index}-${step.name}`,
                      name: step.name,
                      description: step.description,
                      status: step.status,
                      time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())
                    }))
              : current.agentSteps
            },
            (proposal) => normalizeAiDraft(aiData, proposal)
          )
        );
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "AI unavailable.";
        setState((current) => ({
          ...current,
          aiUnavailable: true,
          lastAiError: messageText,
          messages: [
            ...current.messages,
            createMessage(
              "bot",
              "AI is unavailable right now. The local demo workflow is still available for proposal review and participant responses.",
              activeProposal.id
            )
          ]
        }));
      }
    },
    [activeProposal]
  );

  const sendProposal = useCallback(() => {
    setState((current) =>
      updateActiveProposal(
        {
          ...current,
          messages: [...current.messages, createMessage("bot", "Proposal sent. I’ll track each participant response here.", activeProposal.id)],
          notifications: activeProposal.participants
            .filter((participant) => participant.id !== "you")
            .map((participant) => ({
              id: `notify-${participant.id}`,
              participantId: participant.id,
              proposalId: activeProposal.id,
              title: "SplitFlow",
              message: `You were invited to review ${activeProposal.title}. Your estimated share is ₩${participant.shareAmount.toLocaleString("ko-KR")}.`,
              read: false,
              createdAt: new Date().toISOString()
            }))
        },
        (proposal) => ({
          ...proposal,
          status: "waiting_for_responses",
          participants: proposal.participants.map((participant) =>
            participant.id === "you" ? participant : { ...participant, status: participant.status === "not_sent" ? "pending" : participant.status }
          ),
          updatedAt: new Date().toISOString()
        })
      )
    );
  }, [activeProposal]);

  const reviewProposal = useCallback(() => {
    setState((current) => ({
      ...current,
      messages: [...current.messages, createMessage("bot", "The proposal is ready for review. Check the breakdown and fairness note before sending.", activeProposal.id)]
    }));
  }, [activeProposal.id]);

  const askAiToAdjust = useCallback(() => {
    setState((current) => ({
      ...current,
      messages: [...current.messages, createMessage("bot", "Tell me what changed, and I’ll ask the AI Split Agent to draft an adjustment.", activeProposal.id)]
    }));
  }, [activeProposal.id]);

  const respondAsParticipant = useCallback(
    (participantId: string, status: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes">, note?: string) => {
      setState((current) => {
        const withProposal = updateActiveProposal(current, (proposal) => {
          if (status === "opted_out") return applyOptOut(proposal, participantId);

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

          const nextProposal = { ...proposal, participants, updatedAt: new Date().toISOString() };
          return { ...nextProposal, status: deriveProposalStatus(nextProposal) };
        });

        return {
          ...withProposal,
          messages: [
            ...withProposal.messages,
            createMessage(
              "bot",
              status === "accepted"
                ? "Participant accepted. I updated the live status preview."
                : status === "opted_out"
                  ? "Participant opted out. I recalculated shares and marked reconfirmation as required."
                  : "Change request captured. The organizer can review it before booking.",
              activeProposal.id
            )
          ]
        };
      });
    },
    [activeProposal.id]
  );

  const markBooked = useCallback(() => {
    setState((current) =>
      updateActiveProposal(current, (proposal) => ({ ...proposal, status: "settling", isBooked: true, updatedAt: new Date().toISOString() }))
    );
  }, []);

  const markPaid = useCallback((participantId: string) => {
    setState((current) =>
      updateActiveProposal(current, (proposal) => {
        const participants = proposal.participants.map((participant) =>
          participant.id === participantId ? { ...participant, status: "paid" as const, paymentStatus: "paid" as const } : participant
        );
        const allPaid = participants.filter((participant) => participant.status !== "opted_out").every((participant) => participant.paymentStatus === "paid");
        return { ...proposal, participants, status: allPaid ? "settled" : proposal.status, updatedAt: new Date().toISOString() };
      })
    );
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      activeProposal,
      setCurrentUser,
      sendChatMessage,
      sendProposal,
      reviewProposal,
      askAiToAdjust,
      respondAsParticipant,
      markBooked,
      markPaid,
      resetDemo
    }),
    [activeProposal, askAiToAdjust, markBooked, markPaid, resetDemo, respondAsParticipant, reviewProposal, sendChatMessage, sendProposal, setCurrentUser, state]
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
