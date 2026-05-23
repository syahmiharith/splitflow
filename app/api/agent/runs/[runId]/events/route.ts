import type { AgentRunEvent } from "@/lib/types";
import { getWorkflowRunResult, listRunEvents } from "@/lib/workflow/workflow-service";
import { subscribeToRunEvents } from "@/lib/workflow/run-event-bus";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const url = new URL(request.url);
  const afterEventId = url.searchParams.get("afterEventId") ?? undefined;
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        let lastEventId = afterEventId;
        let closed = false;
        const cleanup: { unsubscribe?: () => void; interval?: ReturnType<typeof setInterval> } = {};
        const startedAt = Date.now();

        const close = () => {
          if (closed) return;
          closed = true;
          cleanup.unsubscribe?.();
          if (cleanup.interval) clearInterval(cleanup.interval);
          controller.close();
        };

        const pushEvent = (event: AgentRunEvent) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`id: ${event.id}\n`));
          controller.enqueue(encoder.encode(`event: ${event.type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          lastEventId = event.id;
        };

        const pushPersistedEvents = async () => {
          const events = await listRunEvents(runId, lastEventId);
          for (const event of events) {
            pushEvent(event);
          }
          const result = await getWorkflowRunResult(runId);
          if (!result || Date.now() - startedAt > 60_000) {
            close();
            return;
          }
          if (result?.run.status === "completed" || result?.run.status === "failed") {
            close();
          }
        };

        request.signal.addEventListener("abort", close, { once: true });

        const replay = await listRunEvents(runId, lastEventId);
        replay.forEach(pushEvent);
        const current = await getWorkflowRunResult(runId);
        if (!current) {
          close();
          return;
        }
        if (current?.run.status === "completed" || current?.run.status === "failed") {
          const terminalReplay = await listRunEvents(runId, lastEventId);
          terminalReplay.forEach(pushEvent);
          close();
          return;
        }

        cleanup.unsubscribe = subscribeToRunEvents(runId, pushEvent);
        cleanup.interval = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
          void pushPersistedEvents().catch(() => {
            if (!closed) close();
          });
        }, 1000);
      }
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    }
  );
}
