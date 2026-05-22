import { Check, Circle } from "lucide-react";
import type { AgentStep as AgentStepType } from "@/lib/types";

export function AgentStep({ step, isLast = false }: { step: AgentStepType; isLast?: boolean }) {
  const completed = step.status === "completed";
  return (
    <div className="relative flex gap-3" data-testid={`agent-step-${step.id}`}>
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 grid h-6 w-6 place-items-center rounded-full border ${
            completed ? "border-app-green bg-app-green text-white" : "border-app-amber bg-white text-app-amber"
          }`}
          aria-label={`${step.name} ${step.status}`}
        >
          {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-3 w-3" aria-hidden="true" />}
        </span>
        {!isLast ? <span className={`h-10 w-px ${completed ? "bg-app-green" : "bg-app-border"}`} aria-hidden="true" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="font-semibold text-app-text">{step.name}</div>
          <div className="shrink-0 text-xs text-app-muted">{step.time}</div>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-app-muted">{step.description}</p>
      </div>
    </div>
  );
}
