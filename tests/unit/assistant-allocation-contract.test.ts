import { describe, expect, it } from "vitest";
import { emptyFinance, applyFinanceCommand, categoryAvailable } from "@/lib/finance/model";
import { emptyThread } from "@/lib/assistant/model";
import { runAssistant } from "@/lib/assistant/provider";
import { assistantTools } from "@/lib/assistant/tools";

describe("allocation target provider contract", () => {
  it("exposes explicit target versus signed-change semantics to the provider", () => {
    const schema = JSON.stringify(assistantTools);
    expect(schema).toContain("setMonthly");
    expect(schema).toContain("SIGNED DELTA");
    expect(schema).toContain("not the remaining balance");
  });
  it("prepares a reduction to the target through the provider loop without doing model arithmetic", async () => {
    let state = applyFinanceCommand(emptyFinance(), { type: "account", account: { id: "bank", name: "Bank", currency: "KRW", kind: "bank", openingBalance: 1000000 } });
    state = applyFinanceCommand(state, { type: "category", category: { id: "food", name: "Food", currency: "KRW" } });
    state = applyFinanceCommand(state, { type: "allocate", categoryId: "food", month: "2026-11", amount: 300000 });
    const thread = emptyThread(crypto.randomUUID(), null);
    thread.messages.push({ id: crypto.randomUUID(), role: "user", at: new Date().toISOString(), text: "Reduce Food November allocation from 300000 to 250000." });
    let calls = 0;
    const result = await runAssistant(thread, [], "alex@example.test", async input => {
      expect((input[0] as { content: string }).content).toContain("server computes the change");
      return { output: [{ type: "function_call", call_id: String(calls), name: calls++ ? "prepare_actions" : "read_finance", arguments: JSON.stringify(calls === 1 ? { kind: "summary", month: "2026-11" } : { actions: [{ type: "finance", command: { type: "allocate", categoryId: "food", month: "2026-11", mode: "setMonthly", amount: 250000 } }] }) }] };
    }, [], undefined, undefined, { revision: 1, state });
    expect(result.proposal?.finance?.commands).toHaveLength(1);
    const next = applyFinanceCommand(state, result.proposal!.finance!.commands[0]);
    expect(categoryAvailable(next, "food", "2026-11")).toBe(250000);
    expect(result.proposal!.previews[0].summary?.text).toContain("250,000");
    expect(categoryAvailable(state, "food", "2026-11")).toBe(300000);
  });
});
