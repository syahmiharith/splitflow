import { database } from "@/lib/pilot/server";
import type { DeliveryStatus } from "./policy";
export type NotificationDelivery = { id:string; recordId:string; expenseId:string|null; recipient:string; kind:"invitation"|"reminder";status:DeliveryStatus;availableAt:string;attempts:number };
export async function loadNotificationDeliveries(owner:string,recordId?:string):Promise<NotificationDelivery[]> {
 const rows:NotificationDelivery[]=[];
 for(let offset=0;;offset+=100){
  const page=await database("rpc/read_notification_deliveries",{method:"POST",body:JSON.stringify({p_owner:owner,p_record:recordId??null,p_offset:offset})});
  rows.push(...page);if(page.length<100)return rows;
 }
}
