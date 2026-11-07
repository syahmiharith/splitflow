import {
  actor,
  database,
  failure,
  requireMembership,
  requireWritable,
} from "@/lib/pilot/server";
import { NextRequest, NextResponse } from "next/server";
import {
  applyCommand,
  calculateExpense,
  commandSchema,
  expenseSchema,
  mutationSchema,
  type Split,
} from "@/lib/pilot/model";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    const rows = await database(
      `pilot_memberships?user_id=eq.${user.id}&select=pilot_splits(document)`,
    );
    return NextResponse.json(
      rows.map(
        (row: { pilot_splits: { document: Split } }) =>
          row.pilot_splits.document,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireWritable();
    const user = await actor(request);
    const input = mutationSchema.parse(await request.json());
    const prior = await database(
      `pilot_operations?actor=eq.${user.id}&key=eq.${input.key}&select=result,split_id`,
    );
    if (prior.length) {
      if (prior[0].split_id !== input.id)
        throw new Error("Use a separate submission key for each operation.");
      await requireMembership(input.id, user.id);
      return NextResponse.json(prior[0].result);
    }
    let next: Split;
    if (input.expected === 0) {
      const expense = expenseSchema.parse(input.expense);
      calculateExpense(expense);
      if (!expense.participants.some((p) => p.email === user.email))
        throw new Error("Include yourself in the split.");
      next = {
        id: input.id,
        organizer: user.email,
        revision: 1,
        expense,
        responses: {},
        repayments: [],
        audit: [
          {
            actor: user.email,
            action: "published",
            at: new Date().toISOString(),
          },
        ],
      };
    } else {
      await requireMembership(input.id, user.id);
      const rows = await database(
        `pilot_splits?id=eq.${input.id}&select=document`,
      );
      const current = rows[0]?.document as Split | undefined;
      if (
        !current ||
        !current.expense.participants.some((p) => p.email === user.email)
      )
        throw new Error("Split unavailable for this account.");
      if (current.revision !== input.expected)
        throw new Error(
          "This split changed. Reload and review before retrying.",
        );
      next = applyCommand(
        current,
        user.email,
        commandSchema.parse(input.command),
      );
    }
    const saved = await database("rpc/commit_pilot", {
      method: "POST",
      body: JSON.stringify({
        p_actor: user.id,
        p_key: input.key,
        p_id: input.id,
        p_expected: input.expected,
        p_document: next,
      }),
    });
    return NextResponse.json(saved);
  } catch (error) {
    return failure(error);
  }
}
