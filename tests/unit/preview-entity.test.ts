import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareActions } from "@/lib/assistant/tools";
import { prepareFinanceCommands } from "@/lib/assistant/finance-tools";
import { applyFinanceCommand, emptyFinance } from "@/lib/finance/model";
import { createActivity, createGroup, changeGroup, changeActivity } from "@/lib/activity/model";
import type { RecordRow } from "@/lib/activity/client";

const actor = "alex@example.test", other = "bo@example.test";
const people = [{ name: "Alex", email: actor }, { name: "Bo", email: other }];
const expense = { title: "Dinner", mode: "paid" as const, participants: people.map((p,i) => ({...p,paid:i?0:60000})), items: [{name:"Dinner",amount:60000,included:[actor,other]}] };
const wireExpense = {...expense,items:expense.items.map(item=>({...item,custom:null,units:null}))};
afterEach(()=>vi.unstubAllEnvs());
function fixtures() {
  const group = changeGroup(createGroup(actor,{name:"Friends",people,friendship:true}),other,{type:"join"});
  const activity = createActivity(actor,{title:"Weekend",kind:"quick",people});
  const rows: RecordRow[] = [{kind:"group",document:group},{kind:"activity",document:activity}];
  return {rows,activity};
}
describe("server-derived review entity metadata", () => {
  it("keeps one group identity through creation and rename, retaining each exact snapshot and operation", () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED","true");
    const {rows} = fixtures();
    const p = prepareActions({actions:[{type:"create_group",ref:"outing",input:{name:"Friends",people}},{type:"change_group",target:"outing",command:{type:"rename",name:"Weekend friends"}}]},rows,actor);
    expect(p.previews.map(v=>v.entity)).toEqual([{kind:"group",id:p.operations[0].id},{kind:"group",id:p.operations[0].id}]);
    expect(p.previews[0].group).toEqual({name:"Friends",people:[{...people[0],status:"joined"},{...people[1],status:"invited"}],delivery:"queued_on_confirm"});
    expect(p.previews[1].group).toMatchObject({name:"Weekend friends",delivery:"held"});
    expect(p.previews[0].lines[0]).toBe("Create group");
    expect(p.previews[1].lines[0]).toBe("Rename group");
    expect(p.previews[1].lines).toContain("Rename group: Friends → Weekend friends");
    expect(p.previews[0].group!.name).toBe("Friends");
  });
  it("does not collapse different expenses into their containing activity", () => {
    const {rows,activity} = fixtures();
    const p = prepareActions({actions:[{type:"change_activity",target:activity.id,command:{type:"expense",expense:wireExpense}},{type:"change_activity",target:activity.id,command:{type:"expense",expense:{...wireExpense,title:"Lunch"}}}]},rows,actor);
    expect(p.previews.every(v=>v.entity?.kind==="expense")).toBe(true);
    expect(p.previews[0].entity!.id).toBe(p.previews[0].expenseId);
    expect(p.previews[0].entity!.id).not.toBe(p.previews[1].entity!.id);
    expect(p.previews.every(v=>v.activityId===activity.id)).toBe(true);
  });
  it("identifies existing receipts by payment ID separately from their expense", () => {
    const {rows,activity} = fixtures(), expenseId=crypto.randomUUID(), paymentId=crypto.randomUUID();
    const recorded = changeActivity(activity,actor,{type:"expense",id:expenseId,expense});
    recorded.expenses[0].repayments.push({id:paymentId,from:other,to:actor,amount:30000,status:"reported"});
    const p = prepareActions({actions:[{type:"change_activity",target:activity.id,command:{type:"expenseCommand",id:expenseId,command:{type:"receipt",paymentId,status:"confirmed"}}}]},rows.map(r=>r.kind==="activity"?{kind:"activity",document:recorded}:r),actor);
    expect(p.previews[0].entity).toEqual({kind:"repayment",id:paymentId});
    expect(p.previews[0].expenseId).toBe(expenseId);
  });
  it("keeps a newly reported repayment distinct using its stable proposal operation key", () => {
    const {rows,activity} = fixtures(), expenseId=crypto.randomUUID();
    const recorded = changeActivity(activity,actor,{type:"expense",id:expenseId,expense});
    const p = prepareActions({actions:[{type:"change_activity",target:activity.id,command:{type:"expenseCommand",id:expenseId,command:{type:"report",to:other,amount:1000,reference:"test"}}}]},rows.map(r=>r.kind==="activity"?{kind:"activity",document:recorded}:r),actor);
    expect(p.previews[0].entity).toEqual({kind:"repayment",id:p.operations[0].key});
    expect(p.previews[0].entity!.id).not.toBe(expenseId);
  });
  it("marks invitation delivery held while outbound delivery is disabled", () => {
    vi.stubEnv("NOTIFICATIONS_ENABLED","false");
    const {rows}=fixtures();
    const p=prepareActions({actions:[{type:"create_group",ref:"outing",input:{name:"Friends",people}}]},rows,actor);
    expect(p.previews[0].group!.delivery).toBe("held");
    expect(p.previews[0].lines.join(" ")).toContain("Email delivery is on hold");
    expect(p.previews[0].lines.join(" ")).not.toContain("Email is queued");
  });
  it("uses the same category identity for creation and allocation, preserving operation details", () => {
    const state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"KRW",openingBalance:100000}});
    const p=prepareFinanceCommands({revision:1,state},[{type:"category",category:{id:"food",name:"Food",currency:"KRW",archived:false}},{type:"allocate",categoryId:"food",month:"2026-11",amount:30000}]);
    expect(p.previews.map(v=>v.entity)).toEqual([{kind:"category",id:"food"},{kind:"category",id:"food"}]);
    expect(p.previews[0].lines[0]).toBe("Create category");
    expect(p.previews[1].lines[0]).toBe("Adjust allowance");
    expect(p.previews[1].lines[1]).toContain("30,000");
  });
  it("keeps account, schedule, goal and transaction identities separate", () => {
    let state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"KRW",openingBalance:100000}});
    state=applyFinanceCommand(state,{type:"category",category:{id:"food",name:"Food",currency:"KRW"}});
    const p=prepareFinanceCommands({revision:1,state},[
      {type:"rename",kind:"account",id:"bank",name:"Main bank"},
      {type:"goal",id:"goal",name:"Trip",categoryId:"food",target:50000,targetDate:"2026-12-01"},
      {type:"schedule",schedule:{id:"rent",name:"Rent",accountId:"bank",amount:1000,kind:"expense",start:"2026-11-10",frequency:"monthly",paused:false}},
      {type:"pauseSchedule",id:"rent",paused:true},
      {type:"transaction",transaction:{id:"meal",accountId:"bank",amount:-1000,kind:"expense",date:"2026-11-10",payee:"Meal",cleared:true,splits:[]}},
      {type:"categorize",id:"meal",splits:[{categoryId:"food",amount:1000}]},
    ]);
    expect(p.previews.map(v=>v.entity)).toEqual([{kind:"account",id:"bank"},{kind:"goal",id:"goal"},{kind:"schedule",id:"rent"},{kind:"schedule",id:"rent"},{kind:"transaction",id:"meal"},{kind:"transaction",id:"meal"}]);
  });
});
