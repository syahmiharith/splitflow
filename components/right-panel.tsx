"use client";

import { Sparkles } from "lucide-react";
import { countParticipants } from "@/lib/split";
import type { AgentStep, Proposal } from "@/lib/types";
import { AgentStep as AgentStepItem } from "@/components/ui/agent-step";
import { AppCard } from "@/components/ui/app-card";
import { KpiChip } from "@/components/ui/kpi-chip";
import { StatusBadge } from "@/components/ui/status-badge";

export function RightWorkflowPanel({ proposal, agentSteps }: { proposal: Proposal; agentSteps: AgentStep[] }) {
  const counts = countParticipants(proposal);
  const previewParticipants = proposal.participants.slice(0, 6);

  return (
    <aside className="space-y-4 overflow-y-auto border-t border-app-border bg-page p-4 lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0 lg:bg-white/40" data-testid="right-workflow-panel">
      <AppCard className="p-4" data-testid="agent-workflow-card">
        <h2 className="mb-4 text-lg font-bold">Agent Workflow</h2>
        <div>
          {agentSteps.map((step, index) => (
            <AgentStepItem key={step.id} step={step} isLast={index === agentSteps.length - 1} />
          ))}
        </div>
      </AppCard>

      <AppCard className="overflow-hidden" data-testid="live-status-card">
        <div className="px-4 pt-4">
          <h2 className="text-lg font-bold">Live Status Preview</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
            <KpiChip label="Accepted" value={counts.accepted} tone="green" />
            <KpiChip label="Pending" value={counts.pending} tone="amber" />
            <KpiChip label="Changes" value={counts.changes} tone="violet" />
            <KpiChip label="Paid" value={counts.paid} tone="blue" />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-y border-app-border bg-slate-50 text-xs text-app-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Participant</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {previewParticipants.map((participant) => (
                <tr key={participant.id} data-testid={`status-row-${participant.id}`}>
                  <td className="px-4 py-2.5 font-medium">{participant.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      status={participant.status}
                      label={participant.status === "requested_changes" ? "Requested edit" : undefined}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md border border-app-border bg-slate-50 px-2 py-1 text-xs font-medium text-app-text">
                      {participant.paymentStatus === "paid"
                        ? "Paid"
                        : participant.paymentStatus === "review"
                          ? "Review"
                          : participant.paymentStatus === "remind"
                            ? "Remind"
                            : "Unpaid"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard className="p-4" data-testid="ai-recommendation-card">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-app-blue" aria-hidden="true" />
          <h2 className="text-lg font-bold">AI Recommendation</h2>
        </div>
        <p className="mt-4 pl-9 text-sm leading-6 text-app-text">{proposal.recommendation}</p>
      </AppCard>
    </aside>
  );
}
