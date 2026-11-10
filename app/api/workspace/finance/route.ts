import { NextRequest, NextResponse } from "next/server";
import { actor, failure } from "@/lib/pilot/server";
import { loadFinance } from "@/lib/finance/server";
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    return NextResponse.json(await loadFinance(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
