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
