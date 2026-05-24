"use client";

import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { compactTime } from "@/lib/format";
import type { AgentRun, AgentStep, BotMessage } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const STEP_REVEAL_MS = 450;
const MIN_WORKFLOW_MS = 2800;

const fallbackWorkflowSteps: AgentStep[] = [
  { id: "intake-agent", name: "Intake Agent", description: "Understands the event, people, and decision needed.", time: "—", status: "pending" },
  { id: "cost-agent", name: "Cost Agent", description: "Extracts costs, payers, exclusions, and claimed payments.", time: "—", status: "pending" },
  { id: "fairness-agent", name: "Fairness Agent", description: "Checks assumptions and review risks.", time: "—", status: "pending" },
  { id: "validation-agent", name: "Validation Agent", description: "Validates totals and missing information.", time: "—", status: "pending" },
  { id: "split-agent", name: "Split Agent", description: "Runs deterministic TypeScript split math.", time: "—", status: "pending" },
  { id: "proposal-agent", name: "Proposal Agent", description: "Creates the proposal artifact for review.", time: "—", status: "pending" }
];

export function ChatThread({
  messages,
  agentRuns = [],
  agentSteps = []
}: {
  messages: BotMessage[];
  agentRuns?: AgentRun[];
  agentSteps?: AgentStep[];
}) {
  return (
    <div className="space-y-3" data-testid="chat-messages">
      {messages.map((chatMessage) => (
        <ChatMessageBubble key={chatMessage.id} message={chatMessage} agentRuns={agentRuns} agentSteps={agentSteps} />
      ))}
    </div>
  );
}

export function ChatMessages(props: { messages: BotMessage[]; agentRuns?: AgentRun[]; agentSteps?: AgentStep[] }) {
  return <ChatThread {...props} />;
}

export function ChatMessageBubble({
  message,
  agentRuns = [],
  agentSteps = []
}: {
  message: BotMessage;
  agentRuns?: AgentRun[];
  agentSteps?: AgentStep[];
}) {
  if (message.sender === "agent") {
    const run = agentRuns.find((item) => item.id === message.workflowRunId);
    return <InlineWorkflowMessage message={message} run={run} agentSteps={agentSteps} />;
  }

  const isUser = message.sender === "user";
  const align = isUser ? "justify-end" : "justify-start";
  const width = isUser ? "max-w-[min(560px,78%)]" : "max-w-[min(640px,86%)]";

  return (
    <div className={`flex ${align}`} data-testid={isUser ? "chat-user-message" : "chat-assistant-message"}>
      <div
        className={`${width} rounded-lg border px-4 py-3 text-sm leading-6 shadow-[0_1px_2px_rgba(24,33,47,0.03)] ${
          isUser ? "border-blue-200 bg-blue-50 text-app-text" : "border-app-border bg-white text-app-text"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div className="mt-2 text-xs text-app-muted" suppressHydrationWarning>
          {compactTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function InlineWorkflowMessage({ message, run, agentSteps }: { message: BotMessage; run?: AgentRun; agentSteps: AgentStep[] }) {
  const [now, setNow] = useState(() => Date.now());
  const createdAt = useMemo(() => new Date(message.createdAt).getTime(), [message.createdAt]);
  const elapsed = Math.max(0, now - createdAt);
  const runCompleted = run?.status === "completed";
  const runFailed = run?.status === "failed";
  const steps = useMemo(() => deriveWorkflowSteps(run, agentSteps), [run, agentSteps]);
  const visibleCount = Math.min(steps.length, Math.max(1, Math.floor(elapsed / STEP_REVEAL_MS) + 1));
  const fullyRevealed = visibleCount >= steps.length && elapsed >= MIN_WORKFLOW_MS;
  const heading = runFailed ? "Workflow needs attention" : runCompleted && fullyRevealed ? "Workflow complete" : "Workflow running";

  useEffect(() => {
    if ((runCompleted || runFailed) && fullyRevealed) return;
    const interval = window.setInterval(() => setNow(Date.now()), 160);
    return () => window.clearInterval(interval);
  }, [fullyRevealed, runCompleted, runFailed]);

  return (
    <div className="flex justify-start" data-testid="chat-workflow-message">
      <div className="w-full max-w-[min(680px,92%)] rounded-lg border border-app-border bg-white px-4 py-3 text-sm text-app-text shadow-[0_1px_2px_rgba(24,33,47,0.03)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-app-muted">Agent workflow</div>
            <div className="mt-1 font-bold">{heading}</div>
          </div>
          <span className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-app-muted">
            {Math.min(visibleCount, steps.length)}/{steps.length}
          </span>
        </div>
        <ol className="mt-3 space-y-2">
          {steps.map((step, index) => {
            const visible = index < visibleCount || fullyRevealed;
            const status = workflowStepStatus(step, index, visibleCount, fullyRevealed, Boolean(runCompleted), Boolean(runFailed));
            return (
              <li
                key={step.id}
                data-testid="workflow-step"
                data-status={status}
                className={`grid grid-cols-[20px_minmax(0,1fr)] gap-2 rounded-md border px-2.5 py-2 ${
                  visible ? "border-slate-200 bg-slate-50" : "border-transparent bg-transparent opacity-45"
                }`}
              >
                <span className="mt-0.5 text-app-muted">{statusIcon(status)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-app-text">{step.name}</span>
                  <span className="block break-words text-xs leading-5 text-app-muted">{step.description}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 text-xs text-app-muted" suppressHydrationWarning>
          {compactTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function deriveWorkflowSteps(run: AgentRun | undefined, agentSteps: AgentStep[]): AgentStep[] {
  const completedEvents = run?.events.filter((event) => event.type === "step_completed") ?? [];
  if (completedEvents.length > 0) {
    return completedEvents.map((event) => ({
      id: event.id,
      name: event.step,
      description: event.detail,
      time: compactTime(event.at),
      status: "completed"
    }));
  }
  if (!run || run.status === "completed") {
    if (agentSteps.length > 0) return agentSteps;
  }
  return fallbackWorkflowSteps;
}

function workflowStepStatus(
  step: AgentStep,
  index: number,
  visibleCount: number,
  fullyRevealed: boolean,
  runCompleted: boolean,
  runFailed: boolean
): "pending" | "running" | "completed" | "failed" {
  if (runFailed && index === Math.max(0, visibleCount - 1)) return "failed";
  if (fullyRevealed && runCompleted) return step.status === "pending" ? "pending" : "completed";
  if (index >= visibleCount) return "pending";
  if (index === visibleCount - 1) return step.status === "completed" && !runCompleted ? "completed" : "running";
  return step.status === "pending" ? "pending" : "completed";
}

function statusIcon(status: "pending" | "running" | "completed" | "failed") {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-700" aria-hidden="true" />;
  if (status === "failed") return <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-app-blue" aria-hidden="true" />;
  return <Circle className="h-4 w-4 text-slate-400" aria-hidden="true" />;
}
