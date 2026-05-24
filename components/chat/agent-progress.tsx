"use client";

import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { AgentRun } from "@/lib/types";

export const agentProgress = [
  { agent: "Intake Agent", detail: "Reading organizer request" },
  { agent: "Cost Agent", detail: "Extracting items and participants" },
  { agent: "Fairness Agent", detail: "Checking exclusions and claimed payments" },
  { agent: "Split Agent", detail: "Validating total against itemized costs" },
  { agent: "Split Agent", detail: "Running deterministic split engine" },
  { agent: "Proposal Agent", detail: "Creating proposal artifact" },
  { agent: "Resolution Agent", detail: "Preparing human review actions" }
];

const completedSummary = [
  "Intake Agent understood context",
  "Cost Agent extracted costs",
  "Rules Agent applied exclusions/credits",
  "Validation Agent checked totals",
  "Split Agent ran deterministic math",
  "Readiness Agent found next action"
];

export function AgentRunCard({ progressIndex, run, showEstimated = false }: { progressIndex: number; run?: AgentRun; showEstimated?: boolean }) {
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
  const statusLabel = run ? `${run.status} run ${run.id.slice(0, 8)}` : showEstimated ? "estimated progress" : "starting run";
  const stepLabel = hasRunEvents ? `${Math.min(eventBasedIndex + 1, agentProgress.length)} of ${agentProgress.length}` : `${fallbackIndex + 1} of ${agentProgress.length}`;
  const isCompleted = run?.status === "completed";

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)]" data-testid="agent-run-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-app-text">
            {isCompleted ? <CheckCircle2 className="h-4 w-4 text-app-green" aria-hidden="true" /> : run?.status === "failed" ? <RotateCcw className="h-4 w-4 text-app-red" aria-hidden="true" /> : <Loader2 className="h-4 w-4 animate-spin text-app-blue" aria-hidden="true" />}
            {isCompleted ? "Agent run complete" : currentProgress.agent}
          </div>
          <div className="mt-1 text-xs font-semibold uppercase text-app-muted">{statusLabel}</div>
        </div>
        {showEstimated && !run ? (
          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-app-amber">
            Estimated
          </span>
        ) : null}
      </div>

      {isCompleted ? (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2" data-testid="agent-run-completed-summary">
          {completedSummary.map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs font-semibold text-app-muted">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-app-green" aria-hidden="true" />
              <span className="min-w-0 truncate">{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-app-text">
            {run?.status === "failed" ? (
              <span className="font-semibold text-red-700">{currentProgress.detail}</span>
            ) : completedSteps > 0 ? (
              `${completedSteps} persisted workflow steps completed. ${currentProgress.detail}`
            ) : (
              currentProgress.detail
            )}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-app-blue transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-2 text-xs font-semibold text-app-muted">Step {stepLabel}</div>
        </>
      )}
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

export function AgentProgress(props: { progressIndex: number; run?: AgentRun }) {
  return <AgentRunCard {...props} />;
}

function eventDetail(event: AgentRun["events"][number]): string {
  if ("detail" in event && event.detail) return event.detail;
  if (event.type === "artifact_staged") return `Staged artifact ${event.artifactId.slice(0, 8)}.`;
  return event.type.replaceAll("_", " ");
}
