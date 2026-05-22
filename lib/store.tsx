"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import type { Proposal as DomainProposal } from "@/lib/domain/proposal-types";
import { initialState } from "@/lib/demo-data";
import { countParticipants, deriveProposalStatus } from "@/lib/split";
import { getDemoState, resetDemoData, saveDemoState } from "@/lib/prototype-persistence";
import {
  applyPrototypeAdjustment,
  createBbqProposalFromPrompt,
  loadSubscriptionDemoProposal,
  loadTripDemoProposal,
  recalculateProposal
} from "@/lib/prototype-proposals";
import type { AppState, BotMessage, ParticipantStatus, Proposal, UserMode } from "@/lib/types";

type StoreContextValue = {
  state: AppState;
  activeProposal: Proposal;
  setCurrentUser: (user: UserMode) => void;
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

function normalizeAgentProposal(proposal: DomainProposal, previous: Proposal): Proposal {
  const normalized: Proposal = {
    ...previous,
    id: proposal.id,
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

function upsertFirst(proposals: Proposal[], proposal: Proposal): Proposal[] {
  const without = proposals.filter((item) => item.id !== proposal.id);
  return [proposal, ...without];
}

function updateProposal(state: AppState, proposalId: string | undefined, updater: (proposal: Proposal) => Proposal): AppState {
  const targetId = proposalId ?? state.proposals[0]?.id;
  return {
    ...state,
    proposals: state.proposals.map((proposal) => (proposal.id === targetId ? updater(proposal) : proposal))
  };
}

function appendTimeline(proposal: Proposal, actor: string, text: string): Proposal {
  return {
    ...proposal,
    timeline: [...(proposal.timeline ?? []), { id: crypto.randomUUID(), at: new Date().toISOString(), actor, text }],
    updatedAt: new Date().toISOString()
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(getDemoState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDemoState(state);
  }, [hydrated, state]);

  const activeProposal = state.proposals[0] ?? initialState.proposals[0];

  const setCurrentUser = useCallback((user: UserMode) => {
    setState((current) => ({ ...current, currentUser: user }));
  }, []);

  const setActiveProposal = useCallback((proposalId: string) => {
    setState((current) => {
      const proposal = current.proposals.find((item) => item.id === proposalId);
      if (!proposal) return current;
      return { ...current, proposals: upsertFirst(current.proposals, proposal) };
    });
  }, []);

  const sendChatMessage = useCallback(async (_message: string) => {
    // useChat owns the active chat transport; this legacy action remains for old tests and callers.
  }, []);

  const applyAgentResponse = useCallback((response: OrchestratorResponse, sourceMessage?: string) => {
    setState((current) => {
      const parsed = sourceMessage ? createBbqProposalFromPrompt(sourceMessage) : undefined;
      const adjusted =
        !parsed && sourceMessage
          ? applyPrototypeAdjustment(current.proposals[0] ?? activeProposal, sourceMessage)
          : undefined;
      const proposal =
        parsed ??
        (adjusted?.changed ? appendTimeline(adjusted.proposal, "Organizer", "Applied chat adjustment through deterministic recalculation.") : undefined) ??
        (response.proposal ? normalizeAgentProposal(response.proposal, activeProposal) : undefined);
      const botMessage = createMessage("bot", response.message, proposal?.id ?? activeProposal.id);

      return {
        ...current,
        proposals: proposal ? upsertFirst(current.proposals, proposal) : current.proposals,
        messages: [...current.messages, botMessage],
        aiUnavailable: false,
        lastAiError: undefined,
        agentSteps:
          response.trace.length > 0
            ? response.trace.map((step, index) => ({
                id: `${index}-${step.agent}-${step.action}`,
                name: step.agent,
                description: step.detail,
                status: step.status === "completed" ? "completed" : "pending",
                time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())
              }))
            : current.agentSteps
      };
    });
  }, [activeProposal]);

  const sendProposal = useCallback((proposalId?: string) => {
    setState((current) =>
      updateProposal(
        {
          ...current,
          messages: [...current.messages, createMessage("bot", "Proposal sent. Participant inbox states are now active.", proposalId ?? activeProposal.id)]
        },
        proposalId,
        (proposal) =>
          appendTimeline(
            participantStatusesAfterSend(proposal),
            "Organizer",
            "Sent proposal to participants for review."
          )
      )
    );
  }, [activeProposal.id]);

  const reviewProposal = useCallback(() => {
    setState((current) => ({
      ...current,
      messages: [...current.messages, createMessage("bot", "The proposal is ready for review. The amounts below are deterministic.", activeProposal.id)]
    }));
  }, [activeProposal.id]);

  const askAiToAdjust = useCallback(() => {
    setState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        createMessage("bot", "Describe the adjustment, for example: Daniel did not eat beef, or Sarah should not pay for charcoal.", activeProposal.id)
      ]
    }));
  }, [activeProposal.id]);

  const applyAdjustment = useCallback((prompt: string, proposalId?: string) => {
    setState((current) =>
      updateProposal(current, proposalId, (proposal) => {
        const result = applyPrototypeAdjustment(proposal, prompt);
        if (!result.changed) return appendTimeline(proposal, "Organizer", `Adjustment could not be applied automatically: ${prompt}`);
        return appendTimeline(result.proposal, "Organizer", `Applied AI-assisted adjustment after deterministic recalculation.`);
      })
    );
  }, []);

  const respondAsParticipant = useCallback(
    (
      participantId: string,
      status: Extract<ParticipantStatus, "accepted" | "opted_out" | "requested_changes">,
      note?: string,
      proposalId?: string
    ) => {
      setState((current) => {
        const targetId = proposalId ?? activeProposal.id;
        const next = updateProposal(current, targetId, (proposal) => {
          const participants = proposal.participants.map((participant) => {
            if (participant.id !== participantId) return participant;
            return {
              ...participant,
              status,
              paymentStatus: status === "accepted" ? ("unpaid" as const) : ("review" as const),
              changeRequestNote: status === "requested_changes" ? note || "Requested a proposal change." : participant.changeRequestNote,
              lastRespondedAt: new Date().toISOString()
            };
          });

          const withResponse = appendTimeline(
            { ...proposal, participants, updatedAt: new Date().toISOString() },
            proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId,
            status === "accepted" ? "Accepted the proposal." : status === "opted_out" ? "Opted out of the proposal." : `Requested change: ${note ?? "No note provided."}`
          );

          if (status !== "opted_out") return updateStatusFromParticipants(withResponse);

          const excluded = {
            ...withResponse,
            costItems: withResponse.costItems.map((item) => ({
              ...item,
              excludedParticipantIds: Array.from(new Set([...(item.excludedParticipantIds ?? []), participantId]))
            })),
            status: "recalculation_needed" as const
          };
          return recalculateProposal(excluded, "Participant opted out; recalculation is required.");
        });

        return {
          ...next,
          messages: [
            ...next.messages,
            createMessage(
              "bot",
              status === "accepted"
                ? "Participant accepted. Dashboard status has been updated."
                : status === "opted_out"
                  ? "Participant opted out. I recalculated the proposal and marked it for review."
                  : "Change request captured. The organizer dashboard now prioritizes this proposal.",
              targetId
            )
          ]
        };
      });
    },
    [activeProposal.id]
  );

  const acceptRequestedChange = useCallback((proposalId?: string) => {
    setState((current) =>
      updateProposal(current, proposalId, (proposal) => {
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
      })
    );
  }, []);

  const requestReconfirmation = useCallback((proposalId?: string) => {
    setState((current) =>
      updateProposal(current, proposalId, (proposal) =>
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
      )
    );
  }, []);

  const markBooked = useCallback(() => {
    setState((current) => updateProposal(current, undefined, (proposal) => appendTimeline({ ...proposal, status: "settling", isBooked: true }, "Organizer", "Marked as booked.")));
  }, []);

  const markPaid = useCallback((participantId: string, proposalId?: string) => {
    setState((current) =>
      updateProposal(current, proposalId, (proposal) => {
        const participants = proposal.participants.map((participant) =>
          participant.id === participantId ? { ...participant, status: "paid" as const, paymentStatus: "paid" as const } : participant
        );
        const allPaid = participants
          .filter((participant) => participant.status !== "opted_out")
          .every((participant) => participant.paymentStatus === "paid" || participant.id === proposal.organizerId || participant.id === "you");
        return appendTimeline({ ...proposal, participants, status: allPaid ? "settled" : "partially_paid" }, "Organizer", "Marked participant as paid.");
      })
    );
  }, []);

  const markSettled = useCallback((proposalId?: string) => {
    setState((current) => updateProposal(current, proposalId, (proposal) => appendTimeline({ ...proposal, status: "settled" }, "Organizer", "Marked proposal settled.")));
  }, []);

  const archiveProposal = useCallback((proposalId?: string) => {
    setState((current) => updateProposal(current, proposalId, (proposal) => appendTimeline({ ...proposal, status: "archived" }, "Organizer", "Archived proposal.")));
  }, []);

  const loadDemo = useCallback((kind: "bbq" | "trip" | "subscription") => {
    const proposal =
      kind === "trip"
        ? loadTripDemoProposal()
        : kind === "subscription"
          ? loadSubscriptionDemoProposal()
          : createBbqProposalFromPrompt(
              "BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef."
            ) ?? initialState.proposals[0];
    setState((current) => ({
      ...current,
      proposals: upsertFirst(current.proposals, proposal),
      messages: [...current.messages, createMessage("bot", `Loaded ${proposal.title} demo.`, proposal.id)]
    }));
  }, []);

  const resetDemo = useCallback(() => {
    setState(resetDemoData());
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      activeProposal,
      setCurrentUser,
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
      loadDemo,
      resetDemo
    }),
    [
      state,
      activeProposal,
      setCurrentUser,
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
