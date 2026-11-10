import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AssistantThread } from "@/components/activity/assistant-thread";
import { emptyThread, type Proposal } from "@/lib/assistant/model";
import { summarizeSpendingPlan } from "@/lib/activity/planning";
const previous = {limit:600000,categories:[{name:"Food",amount:400000,expenseIds:[]},{name:"Transport",amount:200000,expenseIds:[]}]};
const current = {...previous,categories:[{name:"Food",amount:370000,expenseIds:[]},{name:"Transport",amount:230000,expenseIds:[]}]};
const proposal: Proposal = {id:"proposal",operations:[],dependencies:[],previews:[{title:"Plan",lines:["Complete historical review"],plan:{previous,current,summary:summarizeSpendingPlan(current,[]),reason:"Change priorities"}}]};
describe("conversation money cards",()=>{
 it("renders one immutable saved change card and hides the duplicate result",()=>{
  Element.prototype.scrollIntoView=vi.fn();
  const thread=emptyThread("thread",null);
  thread.messages=[{id:"1",role:"assistant",text:"",at:"",parts:[{type:"review",proposal,status:"saved"}]},{id:"2",role:"assistant",text:"Saved.",at:"",parts:[{type:"result",proposalId:proposal.id,previews:proposal.previews,records:[]}]}];
  render(<AssistantThread thread={thread} busy={false} error="" onConfirm={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onManual={vi.fn()}/>);
  expect(screen.getAllByText("₩400,000 → ₩370,000")).toHaveLength(1);
  expect(screen.queryByRole("button",{name:"Confirm changes"})).not.toBeInTheDocument();
  expect(screen.getByText("Complete historical review")).not.toBeVisible();
  expect(screen.queryByText("₩600,000")).not.toBeInTheDocument();
 });
 it("retains controls only for the exact pending review",()=>{
  const thread=emptyThread("thread",null);thread.pending=proposal;
  render(<AssistantThread thread={thread} busy={false} error="loading" onConfirm={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onManual={vi.fn()}/>);
  expect(screen.getByRole("button",{name:"Confirm changes"})).toBeVisible();
 });
 it("keeps pending proposals in earlier history read-only",()=>{
  const thread=emptyThread("earlier",null);thread.pending=proposal;thread.messages=[{id:"1",role:"assistant",text:"",at:"",parts:[{type:"review",proposal,status:"pending"}]}];
  render(<AssistantThread readOnly thread={thread} busy={false} error="" onConfirm={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onManual={vi.fn()}/>);
  expect(screen.getByText("₩400,000 → ₩370,000")).toBeVisible();
  expect(screen.queryByRole("button",{name:"Confirm changes"})).not.toBeInTheDocument();
 });
});
