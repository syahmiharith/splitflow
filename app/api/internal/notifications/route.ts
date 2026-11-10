import { NextRequest, NextResponse } from "next/server";
import { deliverNotifications } from "@/lib/notifications/worker";
export async function POST(request: NextRequest) {
 const secret = process.env.CRON_SECRET;
 if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
 try { return NextResponse.json(await deliverNotifications()); }
 catch { return NextResponse.json({error:"Notification worker unavailable."},{status:503}); }
}
