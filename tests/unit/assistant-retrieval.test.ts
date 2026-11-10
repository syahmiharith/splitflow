import { describe, expect, it } from "vitest";
import { readWorkspace } from "@/lib/assistant/retrieval";
import { runAssistant } from "@/lib/assistant/provider";
import { emptyThread } from "@/lib/assistant/model";
import { createActivity, changeActivity } from "@/lib/activity/model";
import type { RecordRow } from "@/lib/activity/client";
const people = [{name:"A",email:"a@example.test"},{name:"B",email:"b@example.test"}];
function fixture(title: string): RecordRow {
  const activity = createActivity(people[0].email,{title,kind:"quick",people});
  return {kind:"activity",document:changeActivity(activity,people[0].email,{type:"expense",id:crypto.randomUUID(),expense:{title:"Meal",mode:"paid",participants:people.map((p,i)=>({...p,paid:i?0:1000})),items:[{name:"Meal",amount:1000,included:people.map(p=>p.email)}]}})};
}
const render = (rows: RecordRow[]) => rows;
describe("authorized workspace retrieval",()=>{
  it("traverses more than twenty records without omission and rejects changed cursors",()=>{
    const rows = Array.from({length:45},(_,i)=>fixture(`Dinner ${i}`));
    const first=readWorkspace({query:null},rows,null,render);
    expect(first).toMatchObject({matchedCount:45,moreAvailable:true,complete:false});
    if(!("nextCursor" in first)) throw Error("Expected page");
    const second=readWorkspace({query:null,cursor:first.nextCursor},rows,null,render);
    if(!("nextCursor" in second)) throw Error("Expected page");
    const third=readWorkspace({query:null,cursor:second.nextCursor},rows,null,render);
    expect(third).toMatchObject({moreAvailable:false});
    expect([first,second,third].flatMap(p=>"records" in p?p.records as RecordRow[]:[])).toHaveLength(45);
    rows[0].document.revision++;
    expect(()=>readWorkspace({query:null,cursor:first.nextCursor},rows,null,render)).toThrow("Workspace changed");
  });
  it("retrieves nested exact expenses and returns no unauthorized references",()=>{
    const row=fixture("Trip"); if(row.kind!=="activity") throw Error("fixture");
    expect(readWorkspace({kind:"expense",recordId:row.document.expenses[0].id},[row],null,render)).toMatchObject({matchedCount:1});
    expect(readWorkspace({kind:"expense",recordId:crypto.randomUUID()},[row],null,render)).toMatchObject({matchedCount:0});
    expect(()=>readWorkspace({owner:"someone else"},[row],null,render)).toThrow();
  });
  it("aggregates every match and keeps claimed spending separate from agreed balances",()=>{
    const rows=Array.from({length:25},()=>fixture("Dinner"));
    expect(readWorkspace({mode:"aggregate"},rows,null,render)).toMatchObject({complete:true,matchedCount:25,totals:{KRW:{reportedCost:25000,agreedBalances:{"a@example.test":0,"b@example.test":0}}}});
  });
  it("does not let current activity bypass an exact lookup",()=>{
    const row=fixture("Dinner");
    expect(readWorkspace({recordId:"missing"},[row],row.document.id,render)).toMatchObject({matchedCount:0});
  });
  it("uses archived conversation lookup without treating it as saved execution",async()=>{
    const thread=emptyThread(crypto.randomUUID(),null);
    let calls=0;
    const result=await runAssistant(thread,[],people[0].email,async input=>{
      if(!calls++) return {output:[{type:"function_call",name:"read_history",arguments:JSON.stringify({query:"rent",cursor:null}),call_id:"history"}]};
      const output=(input as {type?:string;output?:string}[]).find(v=>v.type==="function_call_output")!;
      expect(JSON.parse(output.output!)).toMatchObject({historicalContextOnly:true,archived:[{text:"Old rent discussion"}]});
      return {output:[{type:"message",content:[{type:"output_text",text:"I found the earlier discussion."}]}]};
    },[],undefined,async()=>({messages:[{id:"old",role:"user",text:"Old rent discussion",at:"2026-01-01"}],nextCursor:null}));
    expect(result.proposal).toBeNull();
  });
});
