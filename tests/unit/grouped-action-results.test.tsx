import {render,screen} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
import {GroupedActionResults,groupActionPreviews} from "@/components/activity/grouped-action-results";
import {AssistantThread} from "@/components/activity/assistant-thread";
import {emptyThread,type Preview,type Proposal} from "@/lib/assistant/model";
const created:Preview={title:"Group: Crew",entity:{kind:"group",id:"g"},group:{name:"Crew",people:[{name:"Alex",email:"a@example.test",status:"joined"},{name:"Bob",email:"b@example.test",status:"invited"}],delivery:"held"},lines:["Create group","Alex, Bob"]};
const invited:Preview={...created,group:{...created.group!,people:[...created.group!.people,{name:"Chris",email:"c@example.test",status:"invited"}]},lines:["Invite people","Add access: Chris"]};
describe("one review card per output record",()=>{
 it("combines creation and invitation with one heading and final membership",()=>{
  render(<GroupedActionResults previews={[created,invited]} review/>);
  expect(screen.getAllByRole("heading",{name:"Crew"})).toHaveLength(1);
  expect(screen.getAllByText("a@example.test")).toHaveLength(1);
  expect(screen.getByText("c@example.test")).toBeVisible();
  expect(screen.getByText("Add access: Chris",{selector:"p"})).toBeVisible();
  expect(screen.getAllByText("Details",{selector:"summary"})).toHaveLength(1);
  expect(screen.getByRole("heading",{name:"1. Create group",hidden:true})).not.toBeVisible();
 });
 it("never combines identical titles belonging to different records",()=>{
  expect(groupActionPreviews([created,{...created,entity:{kind:"group",id:"other"}}])).toHaveLength(2);
 });
 it("keeps legacy previews readable and separate without provable identity",()=>{
  const old:Preview={title:"Old group",lines:["Create group","Alex, Bob"]};
  expect(groupActionPreviews([old,{...old}])).toHaveLength(2);
  render(<GroupedActionResults previews={[old]} saved/>);
  expect(screen.getByRole("heading",{name:"Old group"})).toBeVisible();
 });
 it("retains a single current confirmation and immutable saved membership",()=>{
  Element.prototype.scrollIntoView=vi.fn();
  const proposal:Proposal={id:"p",operations:[],dependencies:[],previews:[created,invited]};
  const thread=emptyThread("thread",null);thread.pending=proposal;thread.messages=[{id:"m",role:"assistant",text:"",at:"",parts:[{type:"review",proposal,status:"pending"}]}];
  render(<AssistantThread thread={thread} busy={false} error="" onConfirm={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onManual={vi.fn()}/>);
  expect(screen.getAllByRole("button",{name:"Confirm changes"})).toHaveLength(1);
  expect(created.group!.people).toHaveLength(2);
 });
});

it("shows action labels, rename consequences and original global order",()=>{
 const renamed:Preview={...invited,lines:["Rename group","Rename group: Crew → Weekend"],group:{...invited.group!,name:"Weekend"}};
 render(<GroupedActionResults previews={[created,{title:"Elsewhere",lines:["Create account"],entity:{kind:"account",id:"a"}},renamed]} review/>);
 expect(screen.getByText("Create group · Rename group")).toBeVisible();
 expect(screen.getByText("Rename group: Crew → Weekend",{selector:"p"})).toBeVisible();
 expect(screen.getByRole("heading",{name:"3. Rename group",hidden:true})).toBeInTheDocument();
});
it("keeps parent-only legacy expense identities separate",()=>{
 const one:Preview={title:"Expense",activityId:"a",lines:["Update expense","First cost"]};
 expect(groupActionPreviews([one,{...one,lines:["Update expense","Second cost"]}])).toHaveLength(2);
});
it("keeps both financial consequences under one heading and one disclosure",()=>{
 const first:Preview={title:"Food",entity:{kind:"category",id:"food"},summary:{currency:"KRW",amount:10000,text:"Allocated"},lines:["Allocate category","Add ₩10,000"]};
 const second:Preview={...first,summary:{currency:"KRW",amount:-2000,text:"Released"},lines:["Allocate category","Release ₩2,000"]};
 render(<GroupedActionResults previews={[first,second]} review/>);
 expect(screen.getAllByRole("heading",{name:"Food"})).toHaveLength(1);
 expect(screen.getAllByText("Details",{selector:"summary"})).toHaveLength(1);
 expect(screen.getByText("Add ₩10,000",{selector:".sf-grouped-money-action li"})).toBeVisible();
 expect(screen.getByText("Release ₩2,000",{selector:".sf-grouped-money-action li"})).toBeVisible();
 expect(groupActionPreviews([{...first,entity:{kind:"expense",id:"e"}},{...first,entity:{kind:"repayment",id:"r"}}])).toHaveLength(2);
});
it("does not show delivery guidance for rename alone",()=>{
 render(<GroupedActionResults previews={[{...created,lines:["Rename group","Rename group: Old → Crew"]}]} review/>);
 expect(screen.queryByText(/Email delivery on hold/)).not.toBeInTheDocument();
});
it("keeps new activity context compact beside its first expense",()=>{
 const activity:Preview={title:"Weekend",activityId:"a",entity:{kind:"activity",id:"a"},lines:["Create shared activity","People: Alex, Bob"]};
 const expense:Preview={title:"Dinner",activityId:"a",expenseId:"e",entity:{kind:"expense",id:"e"},expense:{title:"Dinner",mode:"paid",participants:[{name:"Alex",email:"a@example.test",paid:60000},{name:"Bob",email:"b@example.test",paid:0}],items:[{name:"Dinner",amount:60000,included:["a@example.test","b@example.test"]}]},lines:["Add expense","Dinner ₩60,000"]};
 render(<GroupedActionResults previews={[activity,expense]} review/>);
 expect(screen.getByText("New activity · Weekend")).toBeVisible();
 expect(screen.queryByRole("heading",{name:"Weekend"})).not.toBeInTheDocument();
 expect(screen.getByRole("heading",{name:"Dinner"})).toBeVisible();
});
