import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callSplitAgent } from "@/lib/ai/openai";
import { actor, failure, PilotError } from "@/lib/pilot/server";
import { calculateExpense, expenseSchema } from "@/lib/pilot/model";
const inputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  participants: expenseSchema.shape.participants,
});
export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    const input = inputSchema.parse(await request.json());
    if (!input.participants.some((p) => p.email === user.email))
      throw new PilotError("Include yourself in the split.");
    if (
      new Set(input.participants.map((p) => p.name)).size !==
      input.participants.length
    )
      throw new PilotError(
        "Use different names for participants before describing expenses.",
      );
    let result;
    try {
      result = await callSplitAgent({
        message: input.message,
        context: { participantNames: input.participants.map((p) => p.name) },
      });
    } catch {
      throw new PilotError(
        "Unable to draft expenses. Your description is retained. Try again or enter the expense manually.",
        503,
      );
    }
    const draft = result.proposalDraft;
    if (!draft || draft.splitMethod !== "equal")
      throw new PilotError(
        "Use manual item and share controls for this expense. Your description is retained.",
      );
    const participants = input.participants.map((p) => ({ ...p, paid: 0 }));
    const items = draft.costItems.map((item) => {
      const payer = participants.find((p) => p.name === item.paidBy);
      if (!payer)
        throw new PilotError(
          "The payer could not be identified. Specify the participant name or enter the expense manually.",
        );
      payer.paid += item.amount;
      return {
        name: item.label,
        amount: item.amount,
        included: participants.map((p) => p.email),
      };
    });
    const expense = expenseSchema.parse({
      title: draft.title,
      mode: "paid",
      participants,
      items,
    });
    const calculation = calculateExpense(expense);
    if (calculation.total !== draft.totalCost)
      throw new PilotError(
        "The drafted items do not reconcile. Check the amounts manually.",
      );
    return NextResponse.json(expense);
  } catch (error) {
    return failure(error);
  }
}
