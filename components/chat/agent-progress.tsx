"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { AgentRun } from "@/lib/types";

export const agentProgress = [
  { agent: "Intake Agent", detail: "Reading the organizer message and unresolved fields" },
  { agent: "Split Planning Agent", detail: "Choosing the split strategy and deterministic inputs" },
  { agent: "Proposal Agent", detail: "Preparing the reviewable proposal artifact" },
  { agent: "Risk Decision Agent", detail: "Checking whether the split is safe to act on" },
  { agent: "Recommendation Agent", detail: "Preparing the next organizer action" }
];

export function AgentProgress({ progressIndex, run }: { progressIndex: number; run?: AgentRun }) {
  const [retryState, setRetryState] = useState<"idle" | "retrying" | "queued" | "failed">("idle");
  const hasRunEvents = Boolean(run?.events.length);
  const latestEvent = run?.events.at(-1);
  const latestStepStarted = run?.events.slice().reverse().find((event) => event.type === "step_started");
  const completedSteps = run?.events.filter((event) => event.type === "step_completed").length ?? 0;
  const fallbackIndex = Math.min(progressIndex, agentProgress.length - 1);
  const currentProgress = hasRunEvents
    ? {
        agent: run?.status === "failed" ? "Workflow Failed" : run?.status === "completed" ? "Workflow Complete" : latestStepStarted?.step ?? "Workflow Running",
        detail: latestEvent ? eventDetail(latestEvent) : "Waiting for persisted workflow events."
      }
    : agentProgress[fallbackIndex];
  const eventBasedIndex = run?.status === "completed" || run?.status === "failed" ? agentProgress.length - 1 : Math.min(completedSteps, agentProgress.length - 1);
  const progressPercent = Math.round((((hasRunEvents ? eventBasedIndex : fallbackIndex) + 1) / agentProgress.length) * 100);
  const statusLabel = run ? `${run.status} run ${run.id.slice(0, 8)}` : "starting run";
  const stepLabel = hasRunEvents ? `${Math.min(eventBasedIndex + 1, agentProgress.length)} of ${agentProgress.length}` : `${fallbackIndex + 1} of ${agentProgress.length}`;

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
        {run?.status === "failed" ? (
          <span className="font-semibold text-red-700">{currentProgress.detail}</span>
        ) : completedSteps > 0 ? (
          `${completedSteps} persisted workflow steps completed. ${currentProgress.detail}`
        ) : (
          currentProgress.detail
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-app-blue transition-all duration-500" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-2 text-xs font-semibold text-app-muted">
        Step {stepLabel}
      </div>
      {run?.status === "failed" ? (
        <button
          type="button"
          onClick={() => {
            setRetryState("retrying");
            fetch(`/api/agent/runs/${run.id}/retry`, { method: "POST" })
              .then((response) => {
                setRetryState(response.ok ? "queued" : "failed");
              })
              .catch(() => setRetryState("failed"));
          }}
          disabled={retryState === "retrying" || retryState === "queued"}
          className="mt-3 min-h-10 w-full rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {retryState === "retrying" ? "Retrying..." : retryState === "queued" ? "Retry queued" : retryState === "failed" ? "Retry failed" : "Retry run"}
        </button>
      ) : null}
    </div>
  );
}

function eventDetail(event: AgentRun["events"][number]): string {
  if ("detail" in event && event.detail) return event.detail;
  if (event.type === "artifact_staged") return `Staged artifact ${event.artifactId.slice(0, 8)}.`;
  return event.type.replaceAll("_", " ");
}
