import { expect, it } from "vitest";
import { assistantRequest, type AssistantStore } from "@/lib/assistant/service";
import { emptyThread, type AssistantThread } from "@/lib/assistant/model";
import { emptyFinance } from "@/lib/finance/model";
function fixture() {
 let thread=emptyThread(crypto.randomUUID(),null),ledger={revision:0,state:emptyFinance()};
 const results=new Map<string,AssistantThread>();
 const store:AssistantStore={load:async()=>thread,result:async(_id,key)=>results.get(key)??null,rows:async()=>[],finance:async()=>ledger,
  save:async(value,expected,key)=>{if(thread.revision!==expected)throw Error("stale");thread={...value,revision:expected+1};results.set(key,thread);return thread;},
  commit:async(value,expected,key,_results,finance)=>{if(ledger.revision!==finance?.expected)throw Error("stale finance");ledger={revision:ledger.revision+1,state:finance.state};return store.save({...value,pending:null,draft:null},expected,key);}};
 const request=(action:"prepare_finance"|"confirm")=>({id:thread.id,expected:thread.revision,key:crypto.randomUUID(),activityId:null,action});
 const commands=[{type:"account" as const,account:{id:"cash",name:"Cash",kind:"cash" as const,currency:"KRW",openingBalance:1000,archived:false}}];
 return {store,request,commands,ledger:()=>ledger,change:()=>{ledger.revision++;}};
}
it("prepares without mutation and confirms exact stored commands once",async()=>{
 const f=fixture(),review=await assistantRequest({...f.request("prepare_finance"),financeCommands:f.commands},"owner@example.test",f.store);
 expect(f.ledger().state.accounts).toEqual([]);expect(review.title).toBe("Cash");
 const confirm={...f.request("confirm"),proposalId:review.pending!.id};
 const saved=await assistantRequest(confirm,"owner@example.test",f.store);
 expect(f.ledger().state.accounts).toHaveLength(1);
 expect(await assistantRequest(confirm,"owner@example.test",f.store)).toEqual(saved);expect(f.ledger().revision).toBe(1);
});
it("invalidates stale finance reviews without ledger mutation",async()=>{
 const f=fixture(),review=await assistantRequest({...f.request("prepare_finance"),financeCommands:f.commands},"owner@example.test",f.store);
 f.change();const result=await assistantRequest({...f.request("confirm"),proposalId:review.pending!.id},"owner@example.test",f.store);
 expect(result.pending).toBeNull();expect(result.messages.at(-1)?.text).toContain("Personal finances changed");expect(f.ledger().state.accounts).toEqual([]);
});
it("rejects partly invalid manual batches without partial save",async()=>{
 const f=fixture();await expect(assistantRequest({...f.request("prepare_finance"),financeCommands:[...f.commands,...f.commands]},"owner@example.test",f.store)).rejects.toThrow("Account already exists");expect(f.ledger().state.accounts).toEqual([]);
});
