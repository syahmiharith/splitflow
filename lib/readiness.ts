import { formatKrw } from "@/lib/format";
import { hasUnresolvedPaymentClaims } from "@/lib/domain/financial-invariants";
import { countParticipants, isSafeToBook } from "@/lib/split";
import type { ParticipantCounts, Proposal, SplitFlowGroup } from "@/lib/types";

export type ReadinessTone = "blue" | "green" | "amber" | "red" | "slate";

export type ReadinessChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: "done" | "pending" | "attention";
};

export type ReadinessSummary = {
  title: string;
  message: string;
  nextAction: string;
  tone: ReadinessTone;
  blockers: string[];
  counts: ParticipantCounts;
  replyProgress: {
    accepted: number;
    total: number;
    label: string;
  };
  checklist: ReadinessChecklistItem[];
};

export type ShareExplanation = {
  participantName: string;
  share: number;
  net: number;
  included: Array<{ itemId: string; label: string; amount: number; share: number }>;
  excluded: Array<{ itemId: string; label: string; amount: number }>;
  summary: string;
  reasons: string[];
};

export type ActionQueueItem = {
  id: string;
  proposalId: string;
  title: string;
  description: string;
  tone: ReadinessTone;
  actionLabel: string;
};

export type SplitReadinessState = "ready" | "not_ready" | "needs_review" | "settled";

export type SplitReadiness = {
  state: SplitReadinessState;
  label: string;
  blockers: string[];
  nextAction: string;
  responseProgress: {
    confirmed: number;
    total: number;
  };
  claimedPayments: number;
  changeRequests: number;
};

function activeFriendCount(proposal: Proposal): number {
  return proposal.participants.filter((participant) => participant.status !== "opted_out").length;
}

function friendNames(proposal: Proposal, statuses: string[]): string[] {
  return proposal.participants.filter((participant) => statuses.includes(participant.status)).map((participant) => participant.name);
}

function hasClaimedCredit(proposal: Proposal): boolean {
  return hasUnresolvedPaymentClaims(proposal);
}

function participantName(proposal: Proposal, participantId: string): string {
  return proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId;
}

export function deriveSplitReadiness(proposal: Proposal): SplitReadiness {
  const counts = countParticipants(proposal);
  const activeParticipants = proposal.participants.filter((participant) => participant.status !== "opted_out");
  const confirmed = activeParticipants.filter((participant) => participant.status === "accepted" || participant.status === "paid").length;
  const claimedRecords = (proposal.paymentRecords ?? []).filter((record) => record.status === "claimed" || record.status === "disputed");
  const changeRequestParticipants = proposal.participants.filter(
    (participant) => participant.status === "requested_changes" || Boolean(participant.changeRequestNote)
  );
  const pendingParticipants = activeParticipants.filter((participant) => participant.status === "pending" || participant.status === "not_sent");
  const reconfirmParticipants = activeParticipants.filter((participant) => participant.status === "needs_reconfirmation");
  const blockers: string[] = [];

  if (proposal.status === "draft") blockers.push("Split has not been sent for participant agreement yet.");
  for (const participant of changeRequestParticipants.slice(0, 3)) {
    blockers.push(`${participant.name} requested a change${participant.changeRequestNote ? `: ${participant.changeRequestNote}` : "."}`);
  }
  for (const record of claimedRecords.slice(0, 3)) {
    blockers.push(`${participantName(proposal, record.fromParticipantId)}'s ${formatKrw(record.amount)} payment claim needs organizer confirmation.`);
  }
  if (pendingParticipants.length > 0) {
    blockers.push(`${pendingParticipants.length} participant${pendingParticipants.length === 1 ? " has" : "s have"} not confirmed.`);
  }
  if (reconfirmParticipants.length > 0) {
    blockers.push(`${reconfirmParticipants.length} participant${reconfirmParticipants.length === 1 ? " needs" : "s need"} reconfirmation after amount changes.`);
  }
  if (counts.optedOut > 0) {
    blockers.push(`${counts.optedOut} participant${counts.optedOut === 1 ? " has" : "s have"} opted out; shares need review.`);
  }

  const hasBlockingStatus = ["changes_requested", "recalculation_needed", "needs_reconfirmation"].includes(proposal.status);
  const ready = proposal.status === "safe_to_book" && blockers.length === 0 && isSafeToBook(proposal);
  const settled = proposal.status === "settled";
  const state: SplitReadinessState = settled
    ? "settled"
    : ready
      ? "ready"
      : hasBlockingStatus || claimedRecords.length > 0 || changeRequestParticipants.length > 0
        ? "needs_review"
        : "not_ready";
  const label =
    state === "settled"
      ? "Settled"
      : state === "ready"
        ? "Ready to settle"
        : state === "needs_review"
          ? "Needs review"
          : "Not ready to settle";
  const nextAction =
    state === "settled"
      ? "Copy summary"
      : ready
        ? "Mark settled"
        : claimedRecords.length > 0
          ? "Confirm payment claim"
          : changeRequestParticipants.length > 0 || hasBlockingStatus
            ? "Review blockers"
            : proposal.status === "draft"
              ? "Send split"
              : reconfirmParticipants.length > 0
                ? "Reconfirm amounts"
                : pendingParticipants.length > 0
                  ? "Copy reminder"
                  : "Review split";

  return {
    state,
    label,
    blockers,
    nextAction,
    responseProgress: {
      confirmed,
      total: activeParticipants.length
    },
    claimedPayments: claimedRecords.length,
    changeRequests: changeRequestParticipants.length
  };
}

export function deriveReadinessSummary(proposal: Proposal): ReadinessSummary {
  const counts = countParticipants(proposal);
  const activeTotal = activeFriendCount(proposal);
  const blockers: string[] = [];
  const pendingNames = friendNames(proposal, ["not_sent", "pending"]);
  const changeNames = friendNames(proposal, ["requested_changes"]);
  const reconfirmNames = friendNames(proposal, ["needs_reconfirmation"]);

  if (proposal.status === "draft") blockers.push("Proposal has not been sent for participant agreement yet.");
  if (pendingNames.length > 0) blockers.push(`Waiting for ${pendingNames.slice(0, 3).join(", ")}${pendingNames.length > 3 ? ` and ${pendingNames.length - 3} more` : ""}.`);
  if (changeNames.length > 0) blockers.push(`${changeNames.join(", ")} asked for a change.`);
  if (counts.optedOut > 0) blockers.push(`${counts.optedOut} friend${counts.optedOut === 1 ? "" : "s"} opted out, so shares need review.`);
  if (reconfirmNames.length > 0) blockers.push(`${reconfirmNames.join(", ")} need to check the updated amount.`);
  if (hasClaimedCredit(proposal)) blockers.push("A claimed payment note still needs confirmation.");

  const safe = isSafeToBook(proposal) && blockers.length === 0;
  const settled = proposal.status === "settled";
  const collecting = proposal.status === "booked" || proposal.status === "settling" || proposal.status === "partially_paid";
  const title = settled
    ? "Collected"
    : collecting
      ? "Collecting Settlement"
      : safe
        ? "Ready to Settle"
        : proposal.status === "draft"
          ? "Human Review Required"
          : "Not Ready Yet";
  const tone: ReadinessTone = settled || safe ? "green" : changeNames.length > 0 || counts.optedOut > 0 ? "red" : collecting ? "blue" : "amber";
  const message = safe
    ? "Everyone active has accepted and the deterministic amounts are stable."
    : settled
      ? "This proposal has been marked settled."
      : collecting
        ? "Settlement is in progress; keep tracking claimed and confirmed payments."
        : blockers[0] ?? "Review the proposal before anyone fronts money.";
  const nextAction = safe
    ? "Settle with confidence"
    : proposal.status === "draft"
      ? "Send proposal for agreement"
      : changeNames.length > 0 || counts.optedOut > 0
        ? "Resolve changes"
        : reconfirmNames.length > 0
          ? "Ask friends to check again"
          : pendingNames.length > 0
            ? "Wait or nudge friends"
            : hasClaimedCredit(proposal)
              ? "Confirm claimed payment"
              : collecting
                ? "Track settlement"
                : "Review proposal";

  return {
    title,
    message,
    nextAction,
    tone,
    blockers,
    counts,
    replyProgress: {
      accepted: counts.accepted,
      total: activeTotal,
      label: `${counts.accepted}/${activeTotal} friends in`
    },
    checklist: [
      {
        id: "understood",
        label: "Understood",
        detail: proposal.description,
        status: "done"
      },
      {
        id: "costs",
        label: "Costs",
        detail: `${proposal.costItems.length} costs totaling ${formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)}`,
        status: proposal.costItems.length > 0 ? "done" : "attention"
      },
      {
        id: "rules",
        label: "Rules",
        detail: proposal.fairnessNote,
        status: counts.changes > 0 || counts.optedOut > 0 ? "attention" : "done"
      },
      {
        id: "shares",
        label: "Shares",
        detail: "Final amounts come from deterministic split math, not AI.",
        status: proposal.calculationResult?.validationWarnings?.length ? "attention" : "done"
      },
      {
        id: "ready-check",
        label: "Ready Check",
        detail: safe ? "No blockers remain." : blockers[0] ?? "Needs organizer review.",
        status: safe || settled ? "done" : blockers.length > 0 ? "attention" : "pending"
      },
      {
        id: "send",
        label: "Send",
        detail: proposal.status === "draft" ? "Participants have not received the proposal yet." : "The proposal has been sent or reviewed.",
        status: proposal.status === "draft" ? "pending" : "done"
      }
    ]
  };
}

export function deriveParticipantShareExplanation(proposal: Proposal, participantId: string): ShareExplanation {
  const participant = proposal.participants.find((item) => item.id === participantId) ?? proposal.participants[0];
  const calculation = proposal.calculationResult;
  const included = calculation?.itemizedBreakdown
    ?.filter((item) => item.eligibleParticipantIds.includes(participant.id))
    .map((item) => ({
      itemId: item.itemId,
      label: item.label,
      amount: item.amount,
      share: item.shareByParticipant[participant.id] ?? 0
    })) ?? [];
  const excluded = calculation?.itemizedBreakdown
    ?.filter((item) => !item.eligibleParticipantIds.includes(participant.id))
    .map((item) => ({ itemId: item.itemId, label: item.label, amount: item.amount })) ?? [];
  const share = calculation?.fairShareByParticipant?.[participant.id] ?? participant.shareAmount;
  const net = calculation?.netBalanceByParticipant?.[participant.id] ?? 0;
  const reasons = [
    included.length > 0
      ? `${participant.name} is included in ${included.map((item) => item.label).join(", ")}.`
      : `${participant.name} is not included in any active costs.`,
    excluded.length > 0
      ? `${participant.name} is not charged for ${excluded.map((item) => item.label).join(", ")}.`
      : "No special exclusions are applied.",
    net < 0 ? `${participant.name} pays ${formatKrw(Math.abs(net))} back.` : `${participant.name} receives ${formatKrw(Math.abs(net))} back.`
  ];

  return {
    participantName: participant.name,
    share,
    net,
    included,
    excluded,
    summary: `${participant.name}'s share is ${formatKrw(share)} across ${included.length} included cost${included.length === 1 ? "" : "s"}.`,
    reasons
  };
}

export function deriveActionQueue(group: SplitFlowGroup): ActionQueueItem[] {
  const items: ActionQueueItem[] = [];

  for (const proposal of group.proposals) {
    const summary = deriveReadinessSummary(proposal);
    const pendingNames = friendNames(proposal, ["not_sent", "pending"]);
    const changeNames = friendNames(proposal, ["requested_changes"]);
    const reconfirmNames = friendNames(proposal, ["needs_reconfirmation"]);

    if (changeNames.length > 0) {
      items.push({
        id: `${proposal.id}-changes`,
        proposalId: proposal.id,
        title: `${changeNames[0]} asked for a change`,
        description: proposal.participants.find((participant) => participant.name === changeNames[0])?.changeRequestNote ?? "Review the requested change before booking.",
        tone: "red",
        actionLabel: "Resolve change"
      });
      continue;
    }
    if (proposal.status === "recalculation_needed" || summary.counts.optedOut > 0) {
      items.push({
        id: `${proposal.id}-recalculate`,
        proposalId: proposal.id,
        title: "Shares changed",
        description: "Someone opted out, so friends need a fresh amount before booking.",
        tone: "red",
        actionLabel: "Review new shares"
      });
      continue;
    }
    if (reconfirmNames.length > 0) {
      items.push({
        id: `${proposal.id}-reconfirm`,
        proposalId: proposal.id,
        title: `${reconfirmNames[0]} needs to check again`,
        description: "The amount changed after the first reply.",
        tone: "amber",
        actionLabel: "Ask to check"
      });
      continue;
    }
    if (proposal.status === "draft") {
      items.push({
        id: `${proposal.id}-draft`,
        proposalId: proposal.id,
        title: "Proposal is ready for organizer review",
        description: "Review deterministic math, claimed payments, and exclusions before sending for agreement.",
        tone: "blue",
        actionLabel: "Review proposal"
      });
      continue;
    }
    if (pendingNames.length > 0) {
      items.push({
        id: `${proposal.id}-pending`,
        proposalId: proposal.id,
        title: `Waiting for ${pendingNames[0]}`,
        description: `${summary.replyProgress.label}. ${summary.nextAction}.`,
        tone: "amber",
        actionLabel: "Nudge friend"
      });
      continue;
    }
    if (summary.title === "Ready to Settle") {
      items.push({
        id: `${proposal.id}-ready`,
        proposalId: proposal.id,
        title: "Ready to settle",
        description: "Everyone active is in and no blockers remain.",
        tone: "green",
        actionLabel: "Settle"
      });
      continue;
    }
    if (proposal.status === "partially_paid" || proposal.status === "settling") {
      items.push({
        id: `${proposal.id}-payback`,
        proposalId: proposal.id,
        title: "Track payback",
        description: "Booking is done; keep collecting until the split is settled.",
        tone: "blue",
        actionLabel: "View payback"
      });
    }
  }

  return items.slice(0, 5);
}
