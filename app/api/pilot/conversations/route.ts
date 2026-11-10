import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  database,
  failure,
  PilotError,
  requireWritable,
} from "@/lib/pilot/server";
import { conversationInput, type Conversation } from "@/lib/pilot/conversation";
import { calculateExpense } from "@/lib/pilot/model";
import { draftConversation } from "@/lib/pilot/conversation-agent";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    const id = request.nextUrl.searchParams.get("id");
    if (id) z.uuid().parse(id);
    const rows = await database(
      `pilot_conversations?owner=eq.${user.id}${id ? `&id=eq.${id}` : ""}&select=document&order=updated_at.desc&limit=100`,
    );
    return NextResponse.json(
      rows.map((r: { document: Conversation }) => r.document),
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
    const input = conversationInput.parse(await request.json());
    const prior = await database(
      `pilot_conversation_operations?owner=eq.${user.id}&key=eq.${input.key}&select=conversation_id,result`,
    );
    if (prior.length) {
      if (prior[0].conversation_id !== input.id)
        throw new PilotError(
          "Use a separate submission key for each conversation.",
        );
      return NextResponse.json(prior[0].result);
    }
    const rows = await database(
      `pilot_conversations?id=eq.${input.id}&owner=eq.${user.id}&select=document`,
    );
    const current = rows[0]?.document as Conversation | undefined;
    if ((current?.revision ?? 0) !== input.expected)
      throw new PilotError(
        "This conversation changed. Reload it before continuing; your message is retained.",
        409,
      );
    if ((current?.messages.length ?? 0) >= 98)
      throw new PilotError(
        "This conversation is full. Start a new conversation; your split remains available.",
      );
    let draft = input.draft ?? current?.draft ?? null;
    const messages = [...(current?.messages ?? [])];
    if (input.draft) {
      calculateExpense(input.draft);
      if (!input.draft.participants.some((p) => p.email === user.email))
        throw new PilotError("Include yourself in the split.");
      messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Your draft is ready. Review everyone's share before publishing.",
      });
    } else if (input.message) {
      messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: input.message,
      });
      try {
        const result = await draftConversation(messages, draft, user.email);
        if (result.expense) draft = result.expense;
        messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.message,
        });
      } catch {
        messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: !process.env.OPENAI_API_KEY
            ? "AI drafting isn’t enabled on this workspace yet. Your message is saved. Use Enter manually to keep going. Any earlier draft is unchanged."
            : "I couldn’t prepare a reply. Your message is saved. Try again, or use Enter manually to keep going. Any earlier draft is unchanged.",
        });
      }
    }
    const next: Conversation = {
      id: input.id,
      revision: input.expected + 1,
      title: draft?.title ?? current?.title ?? input.message!.slice(0, 80),
      messages,
      draft,
    };
    const saved = await database("rpc/save_pilot_conversation", {
      method: "POST",
      body: JSON.stringify({
        p_owner: user.id,
        p_key: input.key,
        p_expected: input.expected,
        p_document: next,
      }),
    });
    return NextResponse.json(saved);
  } catch (error) {
    return failure(error);
  }
}
