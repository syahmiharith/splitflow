import { describe,it,expect } from "vitest";
import { emptyFinance,applyFinanceCommand } from "@/lib/finance/model";
import { prepareActions } from "@/lib/assistant/tools";
import { readFinance,prepareFinanceCommands } from "@/lib/assistant/finance-tools";
import { runAssistant } from "@/lib/assistant/provider";
import { emptyThread } from "@/lib/assistant/model";
const actor="alex@example.test";
describe("personal finance conversation tools",()=>{
  it("reviews the account and category affected by a recurring cost",()=>{
    let state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"cash",name:"Wallet",kind:"cash",currency:"KRW",openingBalance:100000}});
    state=applyFinanceCommand(state,{type:"category",category:{id:"food",name:"Food",currency:"KRW"}});
    const result=prepareFinanceCommands({revision:1,state},[{type:"schedule",schedule:{id:"monthly",name:"Groceries",accountId:"cash",categoryId:"food",kind:"expense",amount:30000,start:"2026-11-10",frequency:"monthly",paused:false}}]);
    expect(result.previews[0].lines).toEqual(expect.arrayContaining(["Account: Wallet","Category: Food"]));
  });
  it("shows transaction categories and split amounts in the confirmation review",()=>{
    let state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"cash",name:"Wallet",kind:"cash",currency:"KRW",openingBalance:100000}});
    state=applyFinanceCommand(state,{type:"category",category:{id:"food",name:"Food",currency:"KRW"}});
    const result=prepareFinanceCommands({revision:1,state},[{type:"transaction",transaction:{id:"meal",accountId:"cash",amount:-20000,date:"2026-11-10",kind:"expense",payee:"Groceries",cleared:true,splits:[{categoryId:"food",amount:20000}]}}]);
    expect(result.previews[0].lines).toContain("Food: ₩20,000");
  });
  it("prepares account and category allocations as one reviewed batch with server identifiers",()=>{
    const proposal=prepareActions({actions:[
      {type:"finance",command:{type:"account",account:{id:"wallet",name:"Wallet",kind:"cash",currency:"USD",openingBalance:10000}}},
      {type:"finance",command:{type:"category",category:{id:"food",name:"Food",currency:"USD"}}},
      {type:"finance",command:{type:"allocate",categoryId:"food",month:"2026-11",amount:3000}},
    ]},[],actor,{revision:4,state:emptyFinance()});
    expect(proposal.finance?.expected).toBe(4);
    expect(proposal.finance?.commands).toHaveLength(3);
    const account=proposal.finance!.commands[0];expect(account.type).toBe("account");
    if(account.type==="account")expect(account.account.id).not.toBe("wallet");
    expect(proposal.previews[2].summary?.text).toContain("$30.00");
    expect(proposal.previews[2].summary?.text).not.toContain("₩");
  });
  it("preserves shared operations in a mixed reviewed batch",()=>{
    const proposal=prepareActions({actions:[{type:"add_friend",person:{name:"B",email:"b@example.test"}},{type:"finance",command:{type:"account",account:{id:"wallet",name:"Wallet",kind:"cash",currency:"KRW",openingBalance:1000}}}]},[],actor,{revision:0,state:emptyFinance()});
    expect(proposal.operations).toHaveLength(1);expect(proposal.finance?.commands).toHaveLength(1);expect(proposal.previews).toHaveLength(2);
  });
  it("rejects invalid personal work without returning a partial shared proposal",()=>{
    expect(()=>prepareActions({actions:[{type:"add_friend",person:{name:"B",email:"b@example.test"}},{type:"finance",command:{type:"allocate",categoryId:"invented",month:"2026-11",amount:100}}]},[],actor,{revision:0,state:emptyFinance()})).toThrow("unavailable");
  });
  it("paginates and separates currency summaries",()=>{
    let state=emptyFinance();
    for(let i=0;i<25;i++)state=applyFinanceCommand(state,{type:"account",account:{id:String(i),name:`Account ${i}`,kind:"bank",currency:i%2?"KRW":"USD",openingBalance:100}});
    const first=readFinance({kind:"accounts"},{revision:2,state});
    expect(first).toMatchObject({matchedCount:25});
    if(!("nextCursor" in first))throw Error("page");
    expect(readFinance({kind:"accounts",cursor:first.nextCursor},{revision:2,state})).toMatchObject({records:expect.any(Array)});
    expect(()=>readFinance({kind:"accounts",cursor:first.nextCursor},{revision:3,state})).toThrow("changed");
    const totals=readFinance({kind:"summary"},{revision:2,state});
    expect(totals).toMatchObject({complete:true,currencies:expect.arrayContaining([expect.objectContaining({currency:"USD",cash:1300}),expect.objectContaining({currency:"KRW",cash:1200})])});
  });
  it("shares preview validation with manual import",()=>{
    const snapshot={revision:1,state:applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"USD",openingBalance:10000}})};
    const result=prepareFinanceCommands(snapshot,[{type:"transaction",transaction:{id:"a",accountId:"bank",amount:-500,date:"2026-11-10",kind:"expense",payee:"Meal",cleared:true,splits:[]}}]);
    expect(result.previews[0].summary?.text).toContain("$5.00");expect(snapshot.state.transactions).toHaveLength(0);
  });
  it("does not allow invented shared references to enter personal ledger",()=>{
    const state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"USD",openingBalance:10000}});
    expect(()=>prepareActions({actions:[{type:"finance",command:{type:"transaction",transaction:{id:"meal",accountId:"bank",date:"2026-11-10",kind:"expense",amount:-100,payee:"Meal",sharedExpenseId:"someone-elses-expense"}}}]},[],actor,{revision:0,state})).toThrow("Shared expense unavailable");
  });
  it("reads real supplied personal state through the provider tool loop",async()=>{
    let calls=0;
    const result=await runAssistant(emptyThread(crypto.randomUUID(),null),[],actor,async input=>{
      if(!calls++)return {output:[{type:"function_call",name:"read_finance",call_id:"read",arguments:JSON.stringify({kind:"summary"})}]};
      const response=(input as {type?:string;output?:string}[]).find(i=>i.type==="function_call_output")!;
      expect(JSON.parse(response.output!)).toMatchObject({currencies:[],complete:true});
      return {output:[{type:"message",content:[{type:"output_text",text:"No accounts recorded yet."}]}]};
    },[],undefined,undefined,{revision:0,state:emptyFinance()});
    expect(result.proposal).toBeNull();
  });
});

it("prepares opt-in notification preferences with exact revisions and nullable schedule fields",()=>{
  const groupId=crypto.randomUUID();
  const group={kind:"group" as const,document:{id:groupId,revision:1,owner:actor,name:"Friends",people:[{name:"Alex",email:actor},{name:"B",email:"b@example.test"}],joined:[actor],invitations:{"b@example.test":"2026-11-20T00:00:00Z"}}};
  const command={recordId:groupId,expenseId:null,enabled:true,muted:false,stopped:false,snoozedUntil:null,dueAt:null};
  const proposal=prepareActions({actions:[{type:"notifications",command}]},[group],actor,undefined,[{...command,revision:3}]);
  expect(proposal.notifications?.commands[0]).toEqual({...command,expected:3});
  expect(proposal.previews[0].summary?.text).toBe("Automatic reminders enabled");
  expect(proposal.operations).toHaveLength(0);
});
it("collapses large imports into one review while retaining all transaction details",()=>{
  const state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"USD",openingBalance:10000}});
  const result=prepareFinanceCommands({revision:1,state},Array.from({length:30},(_,i)=>({type:"transaction" as const,transaction:{id:`t${i}`,importKey:`i${i}`,accountId:"bank",amount:-100,date:"2026-11-10",kind:"expense" as const,payee:`Meal ${i}`,cleared:true,splits:[]}})));
  expect(result.commands).toHaveLength(30);expect(result.previews).toHaveLength(1);expect(result.previews[0].title).toBe("Import 30 transactions");expect(result.previews[0].lines).toHaveLength(31);expect(result.previews[0].summary?.text).toContain("$30.00 out");
});

it("returns an authorized export handoff without claiming a download",()=>{
 const state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"wallet",name:"Wallet",kind:"bank",currency:"USD",openingBalance:10000}});
 expect(readFinance({kind:"export",recordId:"wallet"},{revision:1,state})).toMatchObject({handoff:{href:"/?finance=wallet",nextAction:"Open this account and select Export CSV."},downloadStarted:false});
 expect(()=>readFinance({kind:"export",recordId:"another-user-account"},{revision:1,state})).toThrow("Choose an account");
 expect(()=>readFinance({kind:"export",recordId:"wallet",month:"2026-10"},{revision:1,state})).toThrow("Filtered exports");
});
it("labels current balances explicitly when returning historical category allocations",()=>{
 const state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"wallet",name:"Wallet",kind:"bank",currency:"USD",openingBalance:10000}});
 const result=readFinance({kind:"summary",month:"2000-01"},{revision:1,state});
 expect(result).toMatchObject({historicalCashSupported:false,categoryThroughMonth:"2000-01",currencies:[{currency:"USD",currentCash:10000}]});
 if(!("currencies" in result)||!result.currencies)throw Error("summary");
 expect(result.currencies[0]).not.toHaveProperty("cash");expect(result.currencies[0]).not.toHaveProperty("readyToAssign");
});

it("finds transactions using an authorized account filter and reports restricted empty results honestly",()=>{
 let state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"USD",openingBalance:10000}});
 state=applyFinanceCommand(state,{type:"account",account:{id:"cash",name:"Cash",kind:"cash",currency:"USD",openingBalance:10000}});
 state=applyFinanceCommand(state,{type:"transaction",transaction:{id:"grocery",accountId:"bank",date:"2026-11-10",amount:-1500,kind:"expense",payee:"Grocery",splits:[],cleared:true}});
 state=applyFinanceCommand(state,{type:"transaction",transaction:{id:"other",accountId:"cash",date:"2026-11-10",amount:-500,kind:"expense",payee:"Other",splits:[],cleared:true}});
 const snapshot={revision:4,state};
 expect(readFinance({kind:"transactions",accountId:"bank"},snapshot)).toMatchObject({matchedCount:1,records:[{id:"grocery"}],scope:{accountId:"bank",recordId:null}});
 expect(()=>readFinance({kind:"transactions",recordId:"bank"},snapshot)).toThrow("Retry with accountId");
 expect(()=>readFinance({kind:"transactions",accountId:"foreign-account"},snapshot)).toThrow("Account unavailable");
 expect(readFinance({kind:"transactions",accountId:"bank",month:"2026-10"},snapshot)).toMatchObject({records:[],matchedCount:0,otherRecordsExist:true,scope:{month:"2026-10"}});
 expect(readFinance({kind:"transactions",accountId:"bank",recordId:"grocery"},snapshot)).toMatchObject({records:[{id:"grocery"}]});
 expect(readFinance({kind:"transactions",accountId:"cash",recordId:"grocery"},snapshot)).toMatchObject({records:[],matchedCount:0});
});
it("binds finance pagination to the account filter",()=>{
 let state=applyFinanceCommand(emptyFinance(),{type:"account",account:{id:"bank",name:"Bank",kind:"bank",currency:"USD",openingBalance:10000}});
 state=applyFinanceCommand(state,{type:"account",account:{id:"cash",name:"Cash",kind:"cash",currency:"USD",openingBalance:10000}});
 for(let i=0;i<21;i++)state=applyFinanceCommand(state,{type:"transaction",transaction:{id:`t${i}`,accountId:"bank",date:"2026-11-10",amount:-100,kind:"expense",payee:"Meal",splits:[],cleared:true}});
 const first=readFinance({kind:"transactions",accountId:"bank"},{revision:1,state});if(!("nextCursor" in first))throw Error("page");
 expect(()=>readFinance({kind:"transactions",accountId:"cash",cursor:first.nextCursor},{revision:1,state})).toThrow("cursor is invalid");
 expect(readFinance({kind:"transactions",accountId:"bank",cursor:first.nextCursor},{revision:1,state})).toMatchObject({records:[{id:"t20"}],matchedCount:21});
});
