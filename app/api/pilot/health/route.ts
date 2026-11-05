import { NextResponse } from "next/server";
import { database } from "@/lib/pilot/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await database("pilot_splits?select=id&limit=0");
    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
