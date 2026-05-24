import { NextResponse } from "next/server";
import { z } from "zod";
import { runOrchestrator } from "@/lib/agents/orchestrator-agent";
import { createOpenAiAgentsRuntime, type OpenAiAgentsRuntime } from "@/lib/agents/openai-agents-runtime";
import type { AgentRuntimeMetadata } from "@/lib/agents/agent-types";
import { MemoryProposalRepository } from "@/lib/repositories/memory-proposal-repository";

export const runtime = "nodejs";

const repository = new MemoryProposalRepository();

const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user_message"),
    message: z.string().min(1).max(2000),
    workflowId: z.string().optional(),
    groupId: z.string().optional(),
    chatId: z.string().optional(),
    sourceMessageId: z.string().optional(),
    idempotencyKey: z.string().optional()
  }),
  z.object({
    type: z.literal("send_proposal"),
    proposalId: z.string().min(1)
  }),
  z.object({
    type: z.literal("participant_response"),
    proposalId: z.string().min(1),
    participantId: z.string().min(1),
    response: z.enum(["accepted", "opted_out", "requested_change"]),
    note: z.string().max(1000).optional()
  })
]);

function routeRuntimeMetadata(agentsRuntime?: OpenAiAgentsRuntime): AgentRuntimeMetadata {
  return {
    route: "/api/agent",
    backend: "runOrchestrator",
    openAiAgentsSdk: {
      envFlagEnabled: process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK === "1",
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
      runtimeCreated: Boolean(agentsRuntime),
      attempted: false,
      invoked: false,
      returnedOutput: false
    }
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  const agentsRuntime = createOpenAiAgentsRuntime();

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid agent request.", runtime: routeRuntimeMetadata(agentsRuntime) }, { status: 400 });
  }

  try {
    const result = await runOrchestrator(parsed.data, { repository, agentsRuntime });
    return NextResponse.json({ ...result, runtime: result.runtime ?? routeRuntimeMetadata(agentsRuntime) });
  } catch {
    return NextResponse.json(
      {
        message: "Agent workflow failed safely.",
        nextActions: ["Try again"],
        trace: [
          {
            agent: "Orchestrator Agent",
            action: "handle_error",
            status: "blocked",
            detail: "The orchestrator caught an internal workflow error."
          }
        ],
        runtime: routeRuntimeMetadata(agentsRuntime)
      },
      { status: 500 }
    );
  }
}
