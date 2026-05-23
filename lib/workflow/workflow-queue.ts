import { executeWorkflowRun } from "@/lib/workflow/workflow-service";
import { getWorkflowRepository, type FileWorkflowRepository } from "@/lib/workflow/file-workflow-repository";

export type WorkflowQueue = {
  enqueueRun: (runId: string, repository?: FileWorkflowRepository) => void;
  isActive: (runId: string) => boolean;
};

const activeRuns = new Set<string>();

export const inProcessWorkflowQueue: WorkflowQueue = {
  enqueueRun(runId, repository = getWorkflowRepository()) {
    if (activeRuns.has(runId)) return;
    activeRuns.add(runId);
    setTimeout(() => {
      void executeWorkflowRun(runId, repository)
        .catch(() => undefined)
        .finally(() => {
          activeRuns.delete(runId);
        });
    }, 0);
  },

  isActive(runId) {
    return activeRuns.has(runId);
  }
};

export function getWorkflowQueue(): WorkflowQueue {
  return inProcessWorkflowQueue;
}
