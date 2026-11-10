import { z } from "zod";
const operationSchema = z.object({ body: z.string(), key: z.uuid() });
export type PendingOperation = z.infer<typeof operationSchema>;
const storageKey = (email: string) => `splitflow-pending:${email}`;
export function readPending(email: string): PendingOperation | undefined {
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? operationSchema.parse(JSON.parse(raw)) : undefined;
  } catch {
    localStorage.removeItem(storageKey(email));
    return undefined;
  }
}
export function storePending(email: string, operation: PendingOperation) {
  localStorage.setItem(storageKey(email), JSON.stringify(operation));
}
export function clearPending(email: string) {
  localStorage.removeItem(storageKey(email));
}
