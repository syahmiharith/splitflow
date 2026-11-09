import { describe, expect, it } from "vitest";
import { notificationEligible } from "@/lib/notifications/eligibility";
import { createActivity, createGroup } from "@/lib/activity/model";
import { type Split, applyCommand } from "@/lib/pilot/model";
const email="owner@example.test", other="friend@example.test";
const people=[{name:"Owner",email},{name:"Friend",email:other}];
describe("notification eligibility",()=>{
 it("suppresses joined, expired and removed invitation recipients",()=>{
  const group=createGroup(email,{name:"Friends",people});
  expect(notificationEligible({kind:"group",document:group},other,null,new Date().toISOString())).toBe(true);
  group.joined.push(other);
  expect(notificationEligible({kind:"group",document:group},other,null,new Date().toISOString())).toBe(false);
  group.joined=[];group.invitations[other]="2020-01-01T00:00:00Z";
  expect(notificationEligible({kind:"group",document:group},other,null,new Date().toISOString())).toBe(false);
 });
 it("requires an agreed positive obligation and suppresses disputed receipts",()=>{
  const activity=createActivity(email,{title:"Dinner",kind:"quick",people});
  let split: Split={id:crypto.randomUUID(),organizer:email,revision:1,responses:{},repayments:[],audit:[],expense:{title:"Dinner",mode:"paid",participants:people.map((p,i)=>({...p,paid:i?0:60000})),items:[{name:"Dinner",amount:60000,included:[email,other]}]}};
  activity.expenses=[split];
  expect(notificationEligible({kind:"activity",document:activity},other,split.id,new Date().toISOString())).toBe(false);
  split=applyCommand(split,other,{type:"respond",status:"accepted",reason:""});activity.expenses=[split];
  expect(notificationEligible({kind:"activity",document:activity},other,split.id,new Date().toISOString())).toBe(true);
  expect(notificationEligible({kind:"activity",document:activity},email,split.id,new Date().toISOString())).toBe(false);
  split.repayments.push({id:"receipt",from:other,to:email,amount:30000,status:"disputed"});
  expect(notificationEligible({kind:"activity",document:activity},other,split.id,new Date().toISOString())).toBe(false);
  split.repayments[0].status="confirmed";
  expect(notificationEligible({kind:"activity",document:activity},other,split.id,new Date().toISOString())).toBe(false);
 });
});
