import { z } from "zod";

export const aiRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z
    .object({
      activeProposalTitle: z.string().optional(),
      participantNames: z.array(z.string()).max(20).optional(),
      totalCost: z.number().nonnegative().optional(),
      proposalStatus: z.string().optional()
    })
    .optional()
});

export const aiCostItemSchema = z.object({
  label: z.string(),
  amount: z.number().nonnegative(),
  paidBy: z.string().optional()
});

export const aiParticipantSchema = z.object({
  name: z.string(),
  shareAmount: z.number().nonnegative().optional(),
  roleNote: z.string().optional()
});

export const aiResponseSchema = z.object({
  assistantMessage: z.string(),
  intent: z.enum(["draft_proposal", "adjust_proposal", "send_reminder", "status_question", "general"]),
  proposalDraft: z
    .object({
      title: z.string(),
      description: z.string(),
      totalCost: z.number().nonnegative(),
      currency: z.literal("KRW"),
      splitMethod: z.enum(["equal", "custom", "unit_based", "mixed_item_based"]),
      costItems: z.array(aiCostItemSchema),
      participants: z.array(aiParticipantSchema),
      fairnessNote: z.string(),
      recommendation: z.string()
    })
    .nullable(),
  agentUpdates: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      status: z.enum(["completed", "pending", "running"])
    })
  )
});

export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;

export const aiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "intent", "proposalDraft", "agentUpdates"],
  properties: {
    assistantMessage: {
      type: "string",
      description: "A concise response from SplitFlow's AI Split Agent."
    },
    intent: {
      type: "string",
      enum: ["draft_proposal", "adjust_proposal", "send_reminder", "status_question", "general"]
    },
    proposalDraft: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "description",
            "totalCost",
            "currency",
            "splitMethod",
            "costItems",
            "participants",
            "fairnessNote",
            "recommendation"
          ],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            totalCost: { type: "number" },
            currency: { type: "string", enum: ["KRW"] },
            splitMethod: { type: "string", enum: ["equal", "custom", "unit_based", "mixed_item_based"] },
            costItems: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "amount", "paidBy"],
                properties: {
                  label: { type: "string" },
                  amount: { type: "number" },
                  paidBy: { type: "string" }
                }
              }
            },
            participants: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "shareAmount", "roleNote"],
                properties: {
                  name: { type: "string" },
                  shareAmount: { type: "number" },
                  roleNote: { type: "string" }
                }
              }
            },
            fairnessNote: { type: "string" },
            recommendation: { type: "string" }
          }
        }
      ]
    },
    agentUpdates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "status"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["completed", "pending", "running"] }
        }
      }
    }
  }
} as const;

export function parseAiResponsePayload(payload: unknown): AiResponse {
  return aiResponseSchema.parse(payload);
}
