import { afterEach, describe, expect, it } from "vitest";
import {
  createOpenAiAgentsRuntime,
  isOpenAiAgentsSdkEnabled,
  splitFlowOrchestratorSdkAgent
} from "@/lib/agents/openai-agents-runtime";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalRuntimeFlag = process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK;
const originalVercel = process.env.VERCEL;

describe("OpenAI Agents SDK runtime", () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK = originalRuntimeFlag;
    process.env.VERCEL = originalVercel;
  });

  it("defines the SplitFlow Orchestrator Agent using the SDK", () => {
    expect(splitFlowOrchestratorSdkAgent.name).toBe("SplitFlow Orchestrator Agent");
  });

  it("stays disabled unless explicitly configured", () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK;
    delete process.env.VERCEL;
    expect(isOpenAiAgentsSdkEnabled()).toBe(false);
    expect(createOpenAiAgentsRuntime()).toBeUndefined();
  });

  it("enables when the runtime flag and API key are present", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK = "1";
    expect(isOpenAiAgentsSdkEnabled()).toBe(true);
    expect(createOpenAiAgentsRuntime()).toBeDefined();
  });

  it("auto-enables in Vercel production when the API key is present", () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK;
    process.env.VERCEL = "1";
    expect(isOpenAiAgentsSdkEnabled()).toBe(true);
    expect(createOpenAiAgentsRuntime()).toBeDefined();
  });
});
