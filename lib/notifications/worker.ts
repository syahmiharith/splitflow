import { database } from "@/lib/pilot/server";
import { sendBrevo, MailRateLimited } from "./delivery";
import type { RecordRow } from "@/lib/activity/client";
import { notificationEligible } from "./eligibility";
type Job = { id: string; record_id: string; recipient: string; kind: "invitation" | "reminder"; event_key: string; attempts: number; expense_id: string | null; policy_owner: string | null };
type Preference = { owner: string; owner_email: string; enabled: boolean; muted: boolean; stopped: boolean; snoozed_until: string | null };
/** Only configured workers claim jobs; missing credentials cannot lose queued work. */
export async function deliverNotifications() {
 if (process.env.NOTIFICATIONS_ENABLED !== "true" || !process.env.BREVO_API_KEY || !process.env.NOTIFICATION_FROM_EMAIL || !process.env.APP_URL) return { accepted:0, failed:0, suppressed:0, configured:false };
 const origin = new URL(process.env.APP_URL);
 if (origin.protocol !== "https:") throw Error("Notification links require HTTPS.");
 await database("rpc/schedule_notification_reminders", {method:"POST",body:"{}"});
 const jobs = await database("rpc/claim_notification_jobs", {method:"POST",body:JSON.stringify({p_limit:20})}) as Job[];
 const counts = { accepted:0, failed:0, suppressed:0, configured:true };
 for (const job of jobs) {
  let status: "accepted" | "failed" | "suppressed" | "queued" = "suppressed";
  let providerId: string | null = null;
  let availableAt: string | undefined;
  let deferred = false;
  try {
   const rows = await database(`activity_records?id=eq.${job.record_id}&select=kind,document`) as RecordRow[];
   const task = encodeURIComponent(job.expense_id ?? "invitation");
   const preferences = await database(`notification_preferences?record_id=eq.${job.record_id}&task_key=eq.${task}&select=owner,owner_email,enabled,muted,stopped,snoozed_until`) as Preference[];
   const recipientPolicy = preferences.find(p => p.owner_email === job.recipient);
   const sourcePolicy = preferences.find(p => p.owner === job.policy_owner);
   const now = new Date().toISOString();
   const membership = rows[0]?.document.people.some(p => p.email === sourcePolicy?.owner_email);
   const enabled = job.kind === "invitation" || (!!sourcePolicy?.enabled && !sourcePolicy.muted && !sourcePolicy.stopped && membership);
   const blocked = recipientPolicy?.muted || recipientPolicy?.stopped;
   const snooze = [recipientPolicy?.snoozed_until,sourcePolicy?.snoozed_until].filter((v):v is string => !!v && Date.parse(v)>Date.parse(now)).sort().at(-1);
   const valid = notificationEligible(rows[0],job.recipient,job.expense_id,now);
   if (valid && enabled && !blocked && snooze) { status="queued";availableAt=snooze;deferred=true; }
   else if (valid && enabled && !blocked) {
    const url = new URL("/", origin); url.searchParams.set(job.expense_id ? "activity" : "group", job.record_id);
    if (job.expense_id) url.searchParams.set("expense",job.expense_id);
    const text = job.expense_id ? "An agreed SplitFlow obligation needs your attention. Open SplitFlow to review its current amount and next action. This reminder does not confirm a payment." : "You have an invitation in SplitFlow. Sign in with the invited email to review it. Joining does not accept any expense or confirm a payment.";
    providerId = await sendBrevo({recipient:job.recipient,subject:job.kind==="invitation"?"Your SplitFlow invitation":"Your SplitFlow reminder",text:`${text}\n\n${url}`,eventKey:job.id});
    status = "accepted";
   }
  } catch (error) {
   if (error instanceof MailRateLimited && job.attempts < 3) { status="queued"; availableAt=new Date(Date.now()+15*60*1000).toISOString(); }
   else status = "failed";
  }
  // Ambiguous provider failures stay failed for explicit recovery, never a blind resend.
  await database(`notification_outbox?id=eq.${job.id}`, {method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status,provider_id:providerId,locked_at:null,...(availableAt?{available_at:availableAt,attempts:deferred?Math.max(0,job.attempts-1):job.attempts}:{})})});
  if(status!=="queued") counts[status]++;
 }
 return counts;
}
