import { test, expect, type Page } from "@playwright/test";
import { assistantRequest, type AssistantStore } from "../../lib/assistant/service";
import { runAssistant, type Provider } from "../../lib/assistant/provider";
import { prepareBatch } from "../../lib/activity/operations";
import type { RecordRow } from "../../lib/activity/client";
import type { AssistantThread } from "../../lib/assistant/model";
import { balances, claimState } from "../../lib/pilot/model";

test("two independent people plan and preserve agreed amounts through disputed revisions and repayments", async ({
  browser, baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch,
  colorScheme, locale, timezoneId,
}) => {
  const alice = "alex@example.test", bob = "minji@example.test";
  const people = [{email:alice,name:"Alex"},{email:bob,name:"Minji"}];
  let rows: RecordRow[] = [];
  const threads = new Map<string, AssistantThread>();
  const operations = new Map<string, AssistantThread>();
  const activity = () => rows.find(r => r.kind === "activity")!.document as Extract<RecordRow,{kind:"activity"}>["document"];
  const expense = (amount:number) => ({title:"Dinner",mode:"paid",participants:people.map(p=>({...p,paid:p.email===alice?amount:0})),items:[{name:"Dinner",amount,included:[alice,bob],custom:null,units:null}]});
  const plan = (food:number,transport:number) => ({limit:600000,categories:[{name:"Food",amount:food,expenseIds:[]},{name:"Transport",amount:transport,expenseIds:[]}]});
  function actions(message:string, actor:string) {
    if (message === "Add Minji as my friend") return [{type:"add_friend",person:people[1]}];
    if (message === "Add Alex as my friend") return [{type:"add_friend",person:people[0]}];
    if (message === "Plan our trip for 600000 won") return [
      {type:"create_activity",ref:"trip",input:{title:"Jeju trip",kind:"planned",people,groupId:null}},
      {type:"change_activity",target:"trip",command:{type:"plan",plan:plan(400000,200000),reason:"Initial trip allowances"}},
    ];
    if (message === "Move 30000 from food to transport") return [{type:"change_activity",target:activity().id,command:{type:"plan",plan:plan(370000,230000),reason:"More transport, same total"}}];
    if (message === "Record dinner at 10000 won paid by Alex") return [{type:"change_activity",target:activity().id,command:{type:"expense",expense:expense(10000)}}];
    const split = activity().expenses[0];
    const command = message === "I dispute that cost; dinner was only 1000 won" ? {type:"respond",status:"declined",reason:"Dinner was only 1000 won"}
      : message === "Correct dinner to 1000 won" ? {type:"revise",expense:expense(1000),reason:"Corrected the entered amount"}
      : message === "Increase dinner to 10000 won" ? {type:"revise",expense:expense(10000),reason:"Claiming a higher amount"}
      : message === "Increase dinner to 12000 won after repayment" ? {type:"revise",expense:expense(12000),reason:"Another claimed increase"}
      : message === "I reject the increased amount" ? {type:"respond",status:"declined",reason:"The agreed dinner total was 1000 won"}
      : message === "I agree to my 500 won share" ? {type:"respond",status:"accepted",reason:"Reviewed the corrected cost"}
      : message === "I paid Alex 500 won" ? {type:"report",to:alice,amount:500,reference:"Bank transfer"}
      : message === "I received the 500 won" ? {type:"receipt",paymentId:split.repayments[0].id,status:"confirmed"}
      : undefined;
    if (!command) throw Error(`Unsupported scripted test message: ${message}`);
    expect(actor === alice || actor === bob).toBe(true);
    return [{type:"change_activity",target:activity().id,command:{type:"expenseCommand",id:split.id,command}}];
  }
  async function person(email:string) {
    // Explicit independent contexts still inherit the active project's device and URL.
    const context = await browser.newContext({
      baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch,
      colorScheme, locale, timezoneId,
    });
    await context.addInitScript(email => localStorage.setItem("splitflow-pilot-session",JSON.stringify({email,access_token:"synthetic-ui-only",refresh_token:"synthetic-ui-only",expires_at:Date.now()/1000+3600})),email);
    const store: AssistantStore = {
      async load(id){return threads.get(email+id)??null;},
      async result(id,key){return operations.get(email+id+key)??null;},
      async rows(){return rows.filter(r=>r.document.people.some(p=>p.email===email));},
      async save(t,revision,key){expect(threads.get(email+t.id)?.revision??0).toBe(revision);const next=structuredClone({...t,revision:revision+1});threads.set(email+t.id,next);operations.set(email+t.id+key,next);return next;},
      async commit(t,revision,key){const prepared=prepareBatch(rows,email,t.pending!.operations);const next=await store.save({...t,pending:null,draft:null},revision,key);rows=prepared.rows;return next;},
    };
    await context.route("**/api/workspace",r=>r.fulfill({json:rows.filter(v=>v.document.people.some(p=>p.email===email))}));
    await context.route("**/api/workspace/assistant**",async route=>{
      const request=route.request(),url=new URL(request.url());
      if(request.method()==="GET") return route.fulfill({json:url.searchParams.has("list")?[]:await store.load(url.searchParams.get("id")!)});
      const input=request.postDataJSON();
      const provider:Provider=async()=>({output:[{type:"function_call",name:"prepare_actions",call_id:"scripted",arguments:JSON.stringify({actions:actions(input.message,email)})}]});
      try{return route.fulfill({json:await assistantRequest(input,email,store,(t,r,e,tool)=>runAssistant(t,r,e,provider,[],tool))});}
      catch(e){return route.fulfill({status:400,json:{error:String(e)}});}
    });
    const page=await context.newPage();await page.goto("/");
    expect(page.viewportSize()).toEqual(viewport);
    if (hasTouch) expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    return {page,context};
  }
  async function send(page:Page,text:string){await page.getByLabel("Message your activity").fill(text);await page.getByRole("button",{name:/^(Start conversation|Send message)$/}).click();await expect(page.getByRole("region",{name:"Review proposed changes"})).toBeVisible();}
  async function confirm(page:Page){await page.getByRole("button",{name:"Confirm changes",exact:true}).click();await expect(page.getByRole("region",{name:"Review proposed changes"})).toHaveCount(0);}
  const a=await person(alice), b=await person(bob);
  await send(a.page,"Add Minji as my friend");await confirm(a.page);
  expect((rows[0].document as Extract<RecordRow,{kind:"group"}>["document"]).joined).toEqual([alice]);
  await b.page.reload();await send(b.page,"Add Alex as my friend");await confirm(b.page);
  expect((rows[0].document as Extract<RecordRow,{kind:"group"}>["document"]).joined).toEqual([alice,bob]);
  await a.page.reload();await send(a.page,"Plan our trip for 600000 won");await confirm(a.page);
  expect(activity().plan?.limit).toBe(600000);
  await send(a.page,"Move 30000 from food to transport");
  await expect(a.page.getByRole("region",{name:"Review proposed changes"})).toContainText("₩400,000 → ₩370,000");
  await a.page.screenshot({path:`../outputs/conversation-workspace/planning-review-${test.info().project.name}.png`});
  await confirm(a.page);
  await send(a.page,"Record dinner at 10000 won paid by Alex");await confirm(a.page);
  expect(balances(activity().expenses[0])[bob]).toBe(0);
  await b.page.reload();await send(b.page,"I dispute that cost; dinner was only 1000 won");await confirm(b.page);
  expect(claimState(activity().expenses[0])).toBe("disputed");
  expect(balances(activity().expenses[0])[bob]).toBe(0);
  await a.page.reload();await send(a.page,"Correct dinner to 1000 won");await confirm(a.page);
  await b.page.reload();await send(b.page,"I agree to my 500 won share");await confirm(b.page);
  expect(balances(activity().expenses[0])[bob]).toBe(500);
  // An inflated replacement must not erase or increase the last agreed obligation.
  await a.page.reload();await send(a.page,"Increase dinner to 10000 won");await confirm(a.page);
  expect(claimState(activity().expenses[0])).toBe("pending");
  expect(balances(activity().expenses[0])[bob]).toBe(500);
  await b.page.reload();await send(b.page,"I reject the increased amount");await confirm(b.page);
  expect(claimState(activity().expenses[0])).toBe("disputed");
  expect(balances(activity().expenses[0])[bob]).toBe(500);
  await send(b.page,"I paid Alex 500 won");await confirm(b.page);
  expect(balances(activity().expenses[0])[bob]).toBe(500);
  await a.page.reload();await send(a.page,"I received the 500 won");await confirm(a.page);
  expect(balances(activity().expenses[0])[bob]).toBe(0);
  // A later false claim cannot recreate debt after the agreed balance was repaid.
  await send(a.page,"Increase dinner to 12000 won after repayment");await confirm(a.page);
  expect(claimState(activity().expenses[0])).toBe("pending");
  expect(balances(activity().expenses[0])[bob]).toBe(0);
  await b.page.reload();await send(b.page,"I reject the increased amount");await confirm(b.page);
  expect(claimState(activity().expenses[0])).toBe("disputed");
  expect(balances(activity().expenses[0])[bob]).toBe(0);
  expect(activity().expenses[0].repayments[0].status).toBe("confirmed");
  expect(activity().expenses[0].responseHistory?.some(response => response.actor === bob && response.status === "accepted")).toBe(true);
  await b.page.reload();
  expect(balances(activity().expenses[0])[bob]).toBe(0);
  await b.page.screenshot({path:`../outputs/conversation-workspace/claim-after-repayment-${test.info().project.name}.png`});
  await expect(a.page.getByLabel("Message destination")).toHaveCount(0);
  expect([...threads.entries()].filter(([key])=>key.startsWith(alice)).every(([,t])=>!t.messages.some(m=>m.role==="user"&&m.text.startsWith("I dispute")))).toBe(true);
  await a.context.close();await b.context.close();
});
