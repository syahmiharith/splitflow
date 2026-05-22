import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createParticipantMessage } from "@/lib/agents/participant-communication-agent";
import { runIntakeAgent } from "@/lib/agents/intake-agent";
import { runRecommendationAgent } from "@/lib/agents/recommendation-agent";
import { AI_MODELS, getModelForAgent } from "@/lib/ai/model-policy";
import { createAcceptedDinnerProposal } from "@/lib/agents/agent-test-fixtures";
import type { Proposal } from "@/lib/domain/proposal-types";

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
});
