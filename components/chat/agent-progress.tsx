"use client";

import { Sparkles } from "lucide-react";

export const agentProgress = [
  { agent: "Intake Agent", detail: "Reading expense request" },
  { agent: "Cost Agent", detail: "Extracting items and participants" },
  { agent: "Fairness Agent", detail: "Checking exclusions and credits" },
  { agent: "Validation Agent", detail: "Validating totals" },
  { agent: "Split Agent", detail: "Running deterministic split engine" },
  { agent: "Proposal Agent", detail: "Creating proposal artifact" }
];

export function AgentProgress({ progressIndex }: { progressIndex: number }) {
  const currentProgress = agentProgress[Math.min(progressIndex, agentProgress.length - 1)];
  const progressPercent = Math.round(((Math.min(progressIndex, agentProgress.length - 1) + 1) / agentProgress.length) * 100);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4" data-testid="agent-progress">
      <div className="flex items-center gap-2 text-sm font-bold text-app-blue">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Running {currentProgress.agent}
      </div>
      <div className="mt-3 rounded-md border border-blue-100 bg-white px-3 py-2 text-sm">
        {currentProgress.detail}
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
