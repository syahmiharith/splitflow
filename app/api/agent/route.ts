import { NextResponse } from "next/server";
import { z } from "zod";
import { runOrchestrator } from "@/lib/agents/orchestrator-agent";
import { createOpenAiAgentsRuntime } from "@/lib/agents/openai-agents-runtime";
import { runRecommendationAgent } from "@/lib/agents/recommendation-agent";
import { runRiskDecisionAgent } from "@/lib/agents/risk-decision-agent";
import type { ExpenseType, ParticipantResponseStatus, PaymentStatus, Proposal as DomainProposal, ProposalStatus, SplitMethod } from "@/lib/domain/proposal-types";
import { MemoryProposalRepository } from "@/lib/repositories/memory-proposal-repository";
import type { Proposal as CanonicalProposal } from "@/lib/types";
import { runWorkflow } from "@/lib/workflow/workflow-service";

export const runtime = "nodejs";

const repository = new MemoryProposalRepository();

function mapExpenseType(proposal: CanonicalProposal): ExpenseType {
  const text = `${proposal.title} ${proposal.description}`.toLowerCase();
  if (/airbnb|hotel|trip|travel/.test(text)) return "travel_accommodation";
  if (/dinner|meal|food|receipt/.test(text)) return "meal";
  if (/subscription|netflix|recurring/.test(text)) return "subscription";
  if (/bill|utility|house/.test(text)) return "bill";
  if (/gift/.test(text)) return "gift";
  return "general";
}

function mapSplitMethod(proposal: CanonicalProposal): SplitMethod {
  if (proposal.splitMethod === "equal") return "equal";
  if (proposal.splitMethod === "custom") return "fixed";
  if (proposal.splitMethod === "unit_based") return "weighted";
  return "weighted";
}

function mapProposalStatus(status: CanonicalProposal["status"]): ProposalStatus {
  if (status === "waiting_for_responses") return "sent";
  if (status === "changes_requested") return "change_requested";
  if (status === "recalculation_needed") return "recalculation_required";
  if (status === "needs_reconfirmation") return "reconfirmation_required";
  if (status === "safe_to_book" || status === "settled" || status === "partially_paid") return "ready_to_pay";
  if (status === "archived") return "accepted";
  return "draft";
}

function mapParticipantStatus(status: CanonicalProposal["participants"][number]["status"]): ParticipantResponseStatus {
  if (status === "accepted" || status === "paid") return "accepted";
  if (status === "opted_out") return "opted_out";
  if (status === "requested_changes") return "requested_change";
  if (status === "needs_reconfirmation") return "reconfirmation_required";
  return "pending";
}

function mapPaymentStatus(status: CanonicalProposal["participants"][number]["paymentStatus"]): PaymentStatus {
  if (status === "paid") return "paid";
  if (status === "review") return "not_applicable";
  return "unpaid";
}

function toDomainProposal(proposal: CanonicalProposal): DomainProposal {
  const method = mapSplitMethod(proposal);
  const shares = proposal.participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    amount: participant.shareAmount,
    weight: participant.units,
    fixedAmount: participant.customAmount
  }));
  return {
    id: proposal.id,
    title: proposal.title,
    organizerName: proposal.organizerName,
    expenseType: mapExpenseType(proposal),
    totalAmount: proposal.totalCost,
    currency: proposal.currency,
    splitMethod: method,
    items: proposal.costItems.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount,
      participantIds: item.includedParticipantIds
    })),
    participants: proposal.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      amountOwed: participant.shareAmount,
      responseStatus: mapParticipantStatus(participant.status),
      paymentStatus: mapPaymentStatus(participant.paymentStatus),
      weight: participant.units,
      fixedAmount: participant.customAmount,
      responseNote: participant.changeRequestNote
    })),
    status: mapProposalStatus(proposal.status),
    assumptions: proposal.parserAssumptions ?? [],
    requiredConfirmations: proposal.participants.filter((participant) => participant.status === "not_sent" || participant.status === "pending").map((participant) => participant.id),
    fairnessExplanation: proposal.fairnessNote,
    calculation: {
      totalAmount: proposal.totalCost,
      currency: proposal.currency,
      method,
      shares,
      remainder: 0,
      explanation: proposal.fairnessNote
    },
    changeRequests: proposal.participants
      .filter((participant) => participant.status === "requested_changes" && participant.changeRequestNote)
      .map((participant) => ({
        participantId: participant.id,
        note: participant.changeRequestNote ?? "",
        createdAt: participant.lastRespondedAt ?? proposal.updatedAt,
        resolved: false
      })),
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt
  };
}

const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user_message"),
    message: z.string().min(1).max(2000),
    workflowId: z.string().optional(),
    groupId: z.string().optional(),
    chatId: z.string().optional(),
    sourceMessageId: z.string().optional(),
    idempotencyKey: z.string().optional()
  }),
  z.object({
    type: z.literal("send_proposal"),
    proposalId: z.string().min(1)
  }),
  z.object({
    type: z.literal("participant_response"),
    proposalId: z.string().min(1),
    participantId: z.string().min(1),
    response: z.enum(["accepted", "opted_out", "requested_change"]),
    note: z.string().max(1000).optional()
  })
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid agent request." }, { status: 400 });
  }

  try {
    if (parsed.data.type === "user_message") {
      const result = await runWorkflow({
        runId: parsed.data.workflowId,
        groupId: parsed.data.groupId ?? "jeju-trip",
        chatId: parsed.data.chatId ?? "chat-jeju-intake",
        sourceMessageId: parsed.data.sourceMessageId,
        message: parsed.data.message,
        idempotencyKey: parsed.data.idempotencyKey ?? parsed.data.workflowId ?? `compat:${parsed.data.message}`
      });
      const message =
        result.assistantMessage?.content ??
        result.run.events.find((event) => event.type === "text_delta")?.delta ??
        "Workflow completed.";
      const proposal = result.proposal ? toDomainProposal(result.proposal) : undefined;
      const risk = proposal ? runRiskDecisionAgent(proposal) : undefined;
      const recommendation = proposal && risk ? runRecommendationAgent({ proposal, risk }) : undefined;
      return NextResponse.json({
        message,
        proposal,
        risk,
        recommendation,
        nextActions: recommendation ? [recommendation.primaryAction, "review_proposal", "send_proposal"] : ["review_proposal", "send_proposal"],
        trace: result.run.events
          .filter((event) => event.type === "step_completed")
          .map((event) => ({
            agent: event.step,
            action: "server_workflow_step",
            status: "completed",
            detail: event.detail
          })),
        run: result.run,
        group: result.group,
        artifacts: result.artifacts
      });
    }
    const result = await runOrchestrator(parsed.data, { repository, agentsRuntime: createOpenAiAgentsRuntime() });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        message: "Agent workflow failed safely.",
        nextActions: ["Try again"],
        trace: [
          {
            agent: "Orchestrator Agent",
            action: "handle_error",
            status: "blocked",
            detail: "The orchestrator caught an internal workflow error."
          }
        ]
      },
      { status: 500 }
    );
  }
}
