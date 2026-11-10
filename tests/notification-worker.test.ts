import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGroup } from "@/lib/activity/model";
const mocks=vi.hoisted(()=>({database:vi.fn(),send:vi.fn()}));
vi.mock("@/lib/pilot/server",()=>({database:mocks.database}));
vi.mock("@/lib/notifications/delivery",async importOriginal=>({...await importOriginal<object>(),sendBrevo:mocks.send}));
import { deliverNotifications } from "@/lib/notifications/worker";
import { MailRateLimited } from "@/lib/notifications/delivery";
const recipient="friend@example.test";
let group: ReturnType<typeof createGroup>;
let preferences: object[];
let attempts: number;
beforeEach(()=>{
 vi.clearAllMocks();preferences=[];attempts=1;
 group=createGroup("owner@example.test",{name:"Synthetic",people:[{name:"Owner",email:"owner@example.test"},{name:"Friend",email:recipient}]});
 vi.stubEnv("NOTIFICATIONS_ENABLED","true");vi.stubEnv("BREVO_API_KEY","test-only");vi.stubEnv("NOTIFICATION_FROM_EMAIL","sender@example.test");vi.stubEnv("APP_URL","https://example.test");
 mocks.send.mockResolvedValue("accepted-id");
 mocks.database.mockImplementation(async(path:string)=>{
  if(path==="rpc/claim_notification_jobs")return [{id:"job",record_id:group.id,recipient,kind:"invitation",event_key:"event",attempts,expense_id:null,policy_owner:null}];
  if(path.startsWith("activity_records"))return [{kind:"group",document:group}];
  if(path.startsWith("notification_preferences"))return preferences;
  return [];
 });
});
afterEach(()=>vi.unstubAllEnvs());
function saved(){const call=mocks.database.mock.calls.find(([path,options])=>path.startsWith("notification_outbox")&&options?.method==="PATCH");return JSON.parse(call![1].body);}
it("does not claim queued work while delivery is on hold",async()=>{
 vi.stubEnv("NOTIFICATIONS_ENABLED","false");
 expect(await deliverNotifications()).toMatchObject({configured:false,accepted:0});
 expect(mocks.database).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
});
it("records provider acceptance without claiming receipt or reading",async()=>{
 expect(await deliverNotifications()).toMatchObject({accepted:1});
 expect(saved()).toMatchObject({status:"accepted",provider_id:"accepted-id",locked_at:null});
 expect(mocks.send.mock.calls[0][0]).toMatchObject({recipient,eventKey:"job"});
});
it.each(["muted","stopped"])("rechecks recipient %s before sending",async flag=>{
 preferences=[{owner_email:recipient,[flag]:true}];
 expect(await deliverNotifications()).toMatchObject({suppressed:1});
 expect(mocks.send).not.toHaveBeenCalled();expect(saved().status).toBe("suppressed");
});
it("suppresses an invitation accepted after it was queued",async()=>{
 group.joined.push(recipient);await deliverNotifications();
 expect(mocks.send).not.toHaveBeenCalled();expect(saved().status).toBe("suppressed");
});
it("defers snoozed work without consuming a send attempt",async()=>{
 preferences=[{owner_email:recipient,snoozed_until:"2099-01-01T00:00:00Z"}];
 await deliverNotifications();expect(saved()).toMatchObject({status:"queued",attempts:0});expect(mocks.send).not.toHaveBeenCalled();
});
it("retries only known rate limits and stops at the attempt bound",async()=>{
 mocks.send.mockRejectedValue(new MailRateLimited());await deliverNotifications();expect(saved().status).toBe("queued");
 mocks.database.mockClear();attempts=3;await deliverNotifications();expect(saved().status).toBe("failed");
});
it("does not blindly retry an ambiguous provider failure",async()=>{
 mocks.send.mockRejectedValue(new Error("connection lost"));await deliverNotifications();
 expect(saved()).toMatchObject({status:"failed",provider_id:null});expect(mocks.send).toHaveBeenCalledTimes(1);
});
