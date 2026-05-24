import { expect, test } from "@playwright/test";
import type { OrchestratorResponse } from "@/lib/agents/agent-types";

const liveAgentEnabled =
  process.env.RUN_LIVE_AGENT_TESTS === "1" &&
  process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK === "1" &&
  Boolean(process.env.OPENAI_API_KEY);

const livePrompt =
  "BBQ dinner for 8. I paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef.";

test.describe("live OpenAI Agents SDK workflow", () => {
  test.skip(!liveAgentEnabled, "RUN_LIVE_AGENT_TESTS=1, SPLITFLOW_USE_OPENAI_AGENTS_SDK=1, and OPENAI_API_KEY are required.");

  test("api agent user_message invokes SDK and preserves deterministic money math", async ({ request }) => {
    const response = await request.post("/api/agent", {
      data: {
        type: "user_message",
        message: livePrompt
      }
    });

    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as OrchestratorResponse;
    const actions = payload.trace.map((step) => step.action);

    expect(actions).toContain("check_openai_agents_sdk");
    expect(actions).toContain("run_openai_agents_sdk");
    expect(payload.runtime).toMatchObject({
      backend: "runOrchestrator",
      openAiAgentsSdk: {
        envFlagEnabled: true,
        apiKeyPresent: true,
        runtimeCreated: true,
        attempted: true,
        invoked: true
      }
    });
    expect(payload.proposal).toBeDefined();
    expect(payload.proposal?.calculation).toBeDefined();
    expect(payload.proposal?.calculation.shares.reduce((sum, share) => sum + share.amount, 0)).toBe(payload.proposal?.totalAmount);
    expect(payload.trace).toContainEqual(
      expect.objectContaining({
        action: "call_deterministic_split_calculator",
        detail: expect.stringContaining("no agent calculated money")
      })
    );
  });

  test("agent lab exposes SDK invocation status", async ({ page }) => {
    await page.goto("/agent-lab");
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page.getByTestId("agent-backend")).toHaveText("runOrchestrator");
    await expect(page.getByTestId("sdk-flag-status")).toHaveText("true");
    await expect(page.getByTestId("sdk-api-key-present")).toHaveText("true");
    await expect(page.getByTestId("sdk-runtime-created")).toHaveText("true");
    await expect(page.getByTestId("sdk-attempted")).toHaveText("true");
    await expect(page.getByTestId("sdk-invoked")).toHaveText("true");
    await expect(page.getByTestId("sdk-trace-count")).toHaveText("1");
  });
});
