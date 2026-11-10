import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor, failure } from "@/lib/pilot/server";
import { serverStore } from "@/lib/assistant/server-store";
import { loadNotificationDeliveries } from "@/lib/notifications/server";
export async function GET(request:NextRequest){
 try {
  const user=await actor(request);
  const raw=request.nextUrl.searchParams.get("recordId");
  const recordId=raw===null?undefined:z.uuid().parse(raw);
  const preferences=await serverStore(user).notifications!();
  return NextResponse.json({preferences:preferences.filter(p=>!recordId||p.recordId===recordId),deliveries:await loadNotificationDeliveries(user.id,recordId),deliveryEnabled:process.env.NOTIFICATIONS_ENABLED==="true"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return failure(error);}
}
