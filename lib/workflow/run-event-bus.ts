import type { AgentRunEvent } from "@/lib/types";

type Listener = (event: AgentRunEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function publishRunEvent(event: AgentRunEvent): void {
  listeners.get(event.runId)?.forEach((listener) => listener(event));
}

export function subscribeToRunEvents(runId: string, listener: Listener): () => void {
  const runListeners = listeners.get(runId) ?? new Set<Listener>();
  runListeners.add(listener);
  listeners.set(runId, runListeners);

  return () => {
    runListeners.delete(listener);
    if (runListeners.size === 0) {
      listeners.delete(runId);
    }
  };
}
