"use client";

import { Sparkles } from "lucide-react";
import type { AgentRun } from "@/lib/types";

export const agentProgress = [
  { agent: "Intake Agent", detail: "Reading the organizer message and unresolved fields" },
  { agent: "Split Planning Agent", detail: "Choosing the split strategy and deterministic inputs" },
  { agent: "Proposal Agent", detail: "Preparing the reviewable proposal artifact" },
  { agent: "Risk Decision Agent", detail: "Checking whether the split is safe to act on" },
  { agent: "Recommendation Agent", detail: "Preparing the next organizer action" }
];

export function AgentProgress({ progressIndex, run }: { progressIndex: number; run?: AgentRun }) {
  const currentProgress = agentProgress[Math.min(progressIndex, agentProgress.length - 1)];
  const progressPercent = Math.round(((Math.min(progressIndex, agentProgress.length - 1) + 1) / agentProgress.length) * 100);
  const completedSteps = run?.events.filter((event) => event.type === "step_completed").length ?? 0;
  const statusLabel = run ? `${run.status} run ${run.id.slice(0, 8)}` : "starting run";

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4" data-testid="agent-progress">
      <div className="flex items-center gap-2 text-sm font-bold text-app-blue">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {currentProgress.agent}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase text-blue-700">
        {statusLabel}
      </div>
      <div className="mt-3 rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-app-text">
        {completedSteps > 0 ? `${completedSteps} workflow steps completed for this chat run.` : currentProgress.detail}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-app-blue transition-all duration-500" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-2 text-xs font-semibold text-app-muted">
        Step {Math.min(progressIndex, agentProgress.length - 1) + 1} of {agentProgress.length}
      </div>
    </div>
  );
}
