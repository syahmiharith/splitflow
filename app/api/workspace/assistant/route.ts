import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor, failure, requireWritable, database } from "@/lib/pilot/server";
import { requestSchema } from "@/lib/assistant/model";
import { assistantRequest } from "@/lib/assistant/service";
import { serverStore, assertThreadAccess } from "@/lib/assistant/server-store";
import { runAssistant } from "@/lib/assistant/provider";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    if (request.nextUrl.searchParams.get("list") === "1") {
      const store = serverStore(user);
      const allowed = new Set((await store.rows()).map((r) => r.document.id));
      const rows = await database(
        `assistant_threads?owner=eq.${user.id}&select=document&order=updated_at.desc&limit=30`,
      );
      const result = rows
        .map(
          (r: { document: import("@/lib/assistant/model").AssistantThread }) =>
            r.document,
        )
        .filter(
          (t: import("@/lib/assistant/model").AssistantThread) =>
            !t.activityId || allowed.has(t.activityId),
        )
        .map((t: import("@/lib/assistant/model").AssistantThread) => ({
          id: t.id,
          activityId: t.activityId,
          title:
            t.messages.find((m) => m.role === "user")?.text.slice(0, 80) ??
            "Conversation",
        }));
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const id = z.uuid().parse(request.nextUrl.searchParams.get("id"));
    const store = serverStore(user);
    const thread = await store.load(id);
    await assertThreadAccess(store, thread);
    return NextResponse.json(thread, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireWritable();
    const user = await actor(request);
    const body = await request.json();
    if (body.action === "resolve") {
      const activityId = z.uuid().parse(body.activityId);
      const thread = await database("rpc/resolve_activity_conversation", {
        method: "POST", body: JSON.stringify({ p_owner: user.id, p_activity: activityId }),
      });
      return NextResponse.json(thread, { headers: { "Cache-Control": "no-store" } });
    }
    const input = requestSchema.parse(body);
    const store = serverStore(user);
    await assertThreadAccess(store, await store.load(input.id));
    return NextResponse.json(
      await assistantRequest(
        input,
        user.email,
        store,
        async (t, r, e, onTool) => {
          const drafts = t.activityId
            ? await database(
                `activity_drafts?owner=eq.${user.id}&activity_id=eq.${t.activityId}&select=slot,document`,
              )
            : [];
          return runAssistant(t, r, e, undefined, drafts, onTool);
        },
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
