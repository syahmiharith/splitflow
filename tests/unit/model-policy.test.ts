import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createParticipantMessage } from "@/lib/agents/participant-communication-agent";
import { runIntakeAgent } from "@/lib/agents/intake-agent";
import { runRecommendationAgent } from "@/lib/agents/recommendation-agent";
import { AI_MODELS, getConfiguredModel, getModelForAgent, getModelForSplitAgentRequest } from "@/lib/ai/model-policy";
import { createAcceptedDinnerProposal } from "@/lib/agents/agent-test-fixtures";
import type { Proposal } from "@/lib/domain/proposal-types";

const originalModelEnv = {
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_MODEL_CHEAP: process.env.OPENAI_MODEL_CHEAP,
  OPENAI_MODEL_DEFAULT: process.env.OPENAI_MODEL_DEFAULT,
  OPENAI_MODEL_ADVANCED: process.env.OPENAI_MODEL_ADVANCED
};

function restoreEnv(name: keyof typeof originalModelEnv) {
  const value = originalModelEnv[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function pendingProposal(): Proposal {
  return {
    ...createAcceptedDinnerProposal(),
    status: "sent",
    participants: createAcceptedDinnerProposal().participants.map((participant, index) => ({
      ...participant,
      responseStatus: index === 0 ? "accepted" : "pending"
    }))
  };
}

describe("model policy", () => {
  beforeEach(() => {
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL_CHEAP;
    delete process.env.OPENAI_MODEL_DEFAULT;
    delete process.env.OPENAI_MODEL_ADVANCED;
  });

  afterEach(() => {
    restoreEnv("OPENAI_MODEL");
    restoreEnv("OPENAI_MODEL_CHEAP");
    restoreEnv("OPENAI_MODEL_DEFAULT");
    restoreEnv("OPENAI_MODEL_ADVANCED");
  });

  it("intake agent uses the default runtime model", () => {
    expect(runIntakeAgent("Split a ₩120,000 dinner equally between 4 people.").model).toBe(AI_MODELS.default);
  });

  it("participant communication uses the cheap model", () => {
    expect(createParticipantMessage(createAcceptedDinnerProposal(), "p1").model).toBe(AI_MODELS.cheap);
  });

  it("recommendation uses the default model by default", () => {
    const proposal = createAcceptedDinnerProposal();
    const recommendation = runRecommendationAgent({
      proposal,
      risk: {
        level: "low",
        reasons: ["All accepted."],
        recommendedNextAction: "Proceed.",
        frontingExposure: 0,
        pendingParticipantIds: []
      }
    });
    expect(recommendation.model).toBe(AI_MODELS.default);
  });

  it("recommendation escalates to the advanced model for blocked risk", () => {
    const proposal = pendingProposal();
    const recommendation = runRecommendationAgent({
      proposal,
      risk: {
        level: "blocked",
        reasons: ["Blocked."],
        recommendedNextAction: "Resolve blockers.",
        frontingExposure: 120000,
        pendingParticipantIds: ["p2"]
      }
    });
    expect(recommendation.model).toBe(AI_MODELS.advanced);
  });

  it("dispute resolution uses the advanced model", () => {
    const proposal: Proposal = {
      ...pendingProposal(),
      changeRequests: [{ participantId: "p2", note: "I joined late.", createdAt: "2026-05-23T00:00:00.000Z", resolved: false }]
    };
    expect(getModelForAgent("Recommendation Agent", { proposal })).toBe(AI_MODELS.advanced);
  });

  it("deterministic services do not import or call OpenAI or model policy", () => {
    const files = sourceFiles(path.join(process.cwd(), "lib", "domain"));
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/@openai|openai|model-policy|getModelForAgent|getRequiredModelForAgent/);
    }
  });

  it("no agent hardcodes model names outside model-policy.ts", () => {
    const files = [
      ...sourceFiles(path.join(process.cwd(), "lib", "agents")),
      path.join(process.cwd(), "lib", "ai", "openai.ts")
    ];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/gpt-\d+(?:\.\d+)?(?:-[a-z]+)?/);
    }
  });

  it("deterministic agents have no model assignment", () => {
    expect(getModelForAgent("Split Planning Agent")).toBeNull();
    expect(getModelForAgent("Response Tracking Agent")).toBeNull();
    expect(getModelForAgent("Recalculation Agent")).toBeNull();
    expect(getModelForAgent("Risk Decision Agent")).toBeNull();
  });

  it("supports tier-specific runtime model overrides", () => {
    process.env.OPENAI_MODEL = "default-from-legacy-env";
    process.env.OPENAI_MODEL_CHEAP = "cheap-from-env";
    process.env.OPENAI_MODEL_ADVANCED = "advanced-from-env";

    expect(getConfiguredModel("default")).toBe("default-from-legacy-env");
    expect(getConfiguredModel("cheap")).toBe("cheap-from-env");
    expect(getConfiguredModel("advanced")).toBe("advanced-from-env");
  });

  it("routes split-agent requests across cheap, default, and advanced models", () => {
    expect(getModelForSplitAgentRequest({ message: "Send a short reminder to Mina.", context: { totalCost: 40000 } })).toBe(AI_MODELS.cheap);
    expect(getModelForSplitAgentRequest({ message: "Draft a KRW 120000 dinner split between four people." })).toBe(AI_MODELS.default);
    expect(
      getModelForSplitAgentRequest({
        message: "Resolve this unfair change request and compare alternatives.",
        context: { proposalStatus: "changes_requested", totalCost: 300000 }
      })
    ).toBe(AI_MODELS.advanced);
  });
});
