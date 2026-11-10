import {describe,it,expect} from "vitest";
import {createActivity,changeActivity} from "@/lib/activity/model";
import {readWorkspace,readableExpense} from "@/lib/assistant/retrieval";
import {readableWorkspace} from "@/lib/assistant/tools";
import {runAssistant} from "@/lib/assistant/provider";
import {emptyThread} from "@/lib/assistant/model";
import type {RecordRow} from "@/lib/activity/client";
const payer="payer@example.test", debtor="debtor@example.test";
const people=[{name:"Payer",email:payer},{name:"Debtor",email:debtor}];
function fixture(){
 let a=createActivity(payer,{title:"Shared meal",kind:"quick",people});
 a=changeActivity(a,payer,{type:"expense",id:crypto.randomUUID(),expense:{title:"Meal",mode:"paid",participants:people.map(p=>({...p,paid:p.email===payer?40000:10000})),items:[{name:"Meal",amount:50000,included:[payer,debtor]}]}});
 a=changeActivity(a,debtor,{type:"expenseCommand",expected:a.expenses[0].revision,id:a.expenses[0].id,command:{type:"respond",status:"accepted",reason:""}});
 return a;
}
describe("shared money read semantics",()=>{
 it("labels debtor and creditor consistently in activity, exact expense and aggregates",()=>{
  const a=fixture(), rows:RecordRow[]=[{kind:"activity",document:a}], id=a.expenses[0].id;
  const labeled={ [debtor]:{signedBalance:15000,owes:15000,isOwed:0}, [payer]:{signedBalance:-15000,owes:0,isOwed:15000}};
  expect(readableExpense(a.expenses[0]).agreedMoneyByPerson).toEqual(labeled);
  expect(readableWorkspace(rows)[0]).toMatchObject({document:{expenses:[{agreedMoneyByPerson:labeled}]}});
  expect(readWorkspace({kind:"expense",recordId:id},rows,a.id,readableWorkspace)).toMatchObject({records:[{data:{agreedMoneyByPerson:labeled}}]});
  expect(readWorkspace({kind:"activity",mode:"aggregate"},rows,a.id,readableWorkspace)).toMatchObject({totals:{KRW:{agreedMoneyByPerson:labeled}}});
 });
 it("keeps prior agreement and confirmed receipts separate from revised claims",()=>{
  let a=fixture();const id=a.expenses[0].id;
  a=changeActivity(a,debtor,{type:"expenseCommand",expected:a.expenses[0].revision,id,command:{type:"report",to:payer,amount:5000,reference:"test"}});
  expect(readableExpense(a.expenses[0]).agreedMoneyByPerson[debtor].owes).toBe(15000);
  a=changeActivity(a,payer,{type:"expenseCommand",expected:a.expenses[0].revision,id,command:{type:"receipt",paymentId:a.expenses[0].repayments[0].id,status:"confirmed"}});
  const revised=structuredClone(a.expenses[0].expense);revised.items[0].amount=60000;revised.participants[0].paid=50000;
  a=changeActivity(a,payer,{type:"expenseCommand",expected:a.expenses[0].revision,id,command:{type:"revise",expense:revised,reason:"Updated cost"}});
  expect(readableExpense(a.expenses[0])).toMatchObject({agreedMoneyByPerson:{[debtor]:{owes:10000}},claimedMoneyByPerson:{[debtor]:{owes:20000}}});
 });
 it("prepares shared repayment through the assistant without any personal account",async()=>{
  const a=fixture();
  const result=await runAssistant(emptyThread(debtor,a.id),[{kind:"activity",document:a}],debtor,async()=>({output:[{type:"function_call",name:"prepare_actions",call_id:"repay",arguments:JSON.stringify({actions:[{type:"change_activity",target:a.id,command:{type:"expenseCommand",expected:a.expenses[0].revision,id:a.expenses[0].id,command:{type:"report",to:payer,amount:15000,reference:"Bank receipt"}}}]})}]}));
  expect(result.proposal?.finance).toBeUndefined();
  expect(result.proposal?.previews[0].transfer).toMatchObject({from:"Debtor",to:"Payer",amount:15000,status:"reported",reference:"Bank receipt"});
  expect(a.expenses[0].repayments).toHaveLength(0);
 });
});

it("supplies only the current authorized activity with exact payment references before the latest request",async()=>{
 let a=fixture();const id=a.expenses[0].id;
 a=changeActivity(a,debtor,{type:"expenseCommand",id,expected:a.expenses[0].revision,command:{type:"report",to:payer,amount:15000,reference:"Receipt ref"}});
 const other=fixture();other.title="Other private activity";
 const thread=emptyThread(payer,a.id);
 thread.messages=[{id:crypto.randomUUID(),role:"user",text:"Confirm the payment",at:new Date().toISOString()}];
 await runAssistant(thread,[{kind:"activity",document:a},{kind:"activity",document:other}],payer,async input=>{
  const text=JSON.stringify(input);
  expect(text).toContain(a.expenses[0].repayments[0].id);
  expect(text).toContain("agreedMoneyByPerson");expect(text).not.toContain("Other private activity");
  expect(input.at(-1)).toEqual({role:"user",content:"Confirm the payment"});
  return {output:[{type:"message",content:[{type:"output_text",text:"Which receipt?"}]}]};
 });
 const foreign=emptyThread("outsider@example.test",a.id);
 await runAssistant(foreign,[{kind:"activity",document:a}],"outsider@example.test",async input=>{
  expect(JSON.stringify(input)).not.toContain("Receipt ref");
  return {output:[{type:"message",content:[{type:"output_text",text:"Hello"}]}]};
 });
});
it("bounds oversized current activity context without presenting partial totals",async()=>{
 const a=fixture();a.expenses=Array.from({length:100},()=>structuredClone(a.expenses[0]));
 await runAssistant(emptyThread(payer,a.id),[{kind:"activity",document:a}],payer,async input=>{
  const context=input.find(item=>typeof item==="object"&&item!==null&&"content" in item&&typeof item.content==="string"&&item.content.startsWith('{"untrustedCurrentActivityContext"')) as {content:string};
  expect(context.content.length).toBeLessThan(40000);
  expect(JSON.parse(context.content)).toMatchObject({untrustedCurrentActivityContext:{id:a.id,revision:a.revision,title:a.title,detailsOmitted:true}});
  expect(context.content).not.toContain("agreedMoneyByPerson");expect(context.content).not.toContain('"total"');
  return {output:[{type:"message",content:[{type:"output_text",text:"Checking"}]}]};
 });
});
