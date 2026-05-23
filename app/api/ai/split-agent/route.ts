import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { callSplitAgent } from "@/lib/ai/openai";
import { aiRequestSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

const legacyHeaders = {
  "X-SplitFlow-Route-Status": "deprecated",
  "X-SplitFlow-Replacement": "/api/agent"
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = aiRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI request." }, { status: 400, headers: legacyHeaders });
  }

  try {
    const result = await callSplitAgent(parsed.data);
    return NextResponse.json({ data: result }, { headers: legacyHeaders });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "AI returned an invalid structured response." }, { status: 502, headers: legacyHeaders });
    }

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: "AI unavailable. Configure OPENAI_API_KEY on the server." }, { status: 503, headers: legacyHeaders });
    }

    return NextResponse.json({ error: "AI unavailable. Try again later." }, { status: 503, headers: legacyHeaders });
  }
}
