import { beforeEach, expect, it } from "vitest";
import {
  clearPending,
  readPending,
  storePending,
} from "@/lib/pilot/pending-operation";
beforeEach(() => localStorage.clear());
it("recovers the exact request key after reload without sharing another account request", () => {
  const operation = {
    body: JSON.stringify({ id: crypto.randomUUID(), expected: 1 }),
    key: crypto.randomUUID(),
  };
  storePending("a@example.com", operation);
  expect(readPending("a@example.com")).toEqual(operation);
  expect(readPending("b@example.com")).toBeUndefined();
  clearPending("a@example.com");
  expect(readPending("a@example.com")).toBeUndefined();
});
it("discards malformed pending data", () => {
  localStorage.setItem("splitflow-pending:a@example.com", "broken");
  expect(readPending("a@example.com")).toBeUndefined();
});
