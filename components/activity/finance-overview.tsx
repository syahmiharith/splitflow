"use client";
import { useEffect, useState } from "react";
import { exportTransactions } from "@/lib/finance/csv";
import { loadFinance } from "@/lib/finance/client";
import { accountBalance, financeSummary, type FinanceState } from "@/lib/finance/model";
import { formatMoney } from "@/lib/finance/money";
export function FinanceOverview({guest,email,onAsk}:{guest:boolean;email:string;onAsk:(text:string)=>void}) {
 const [state,setState]=useState<FinanceState>();
 const [error,setError]=useState("");
 const [view,setView]=useState<"accounts"|"plan"|"upcoming">("accounts");
 const [accountId,setAccountId]=useState("");
 useEffect(()=>{let active=true;void loadFinance(guest,email).then(r=>{if(active)setState(r.state);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[guest,email]);
 if(error)return <p role="alert">{error}</p>;
 if(!state)return <p role="status">Loading your finances…</p>;
 const summary=financeSummary(state,new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"}).slice(0,7));
 const selected=state.accounts.find(a=>a.id===accountId);
 function download(){ if(!state||!selected)return;const url=URL.createObjectURL(new Blob([exportTransactions(state,selected.id)],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="splitflow-transactions.csv";a.click();URL.revokeObjectURL(url); }
 return <section className="mx-auto w-full max-w-3xl px-4 py-6" aria-label="Personal finances">
  <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">Your finances</h1><button className="sf-assistant-confirm" onClick={()=>onAsk("Help me manage my personal finances.")}>Ask SplitFlow</button></div>
  <nav className="my-5 flex gap-2" aria-label="Finance views">{(["accounts","plan","upcoming"] as const).map(tab=><button key={tab} aria-current={view===tab?"page":undefined} className={`min-h-11 rounded-lg px-3 text-sm ${view===tab?"bg-slate-100 font-semibold":""}`} onClick={()=>setView(tab)}>{tab==="accounts"?"Accounts":tab==="plan"?"Plan & goals":"Upcoming"}</button>)}</nav>
  {view==="accounts"&&<>
   {!state.accounts.length&&<div className="py-8"><p>No recorded accounts yet.</p><button className="min-h-11 underline" onClick={()=>onAsk("Help me add my first account. Ask me for its currency and starting balance.")}>Add an account in conversation</button></div>}
   {state.accounts.filter(a=>!a.archived).map(a=><button key={a.id} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-slate-200 py-3 text-left" onClick={()=>setAccountId(a.id)}><span>{a.name}<small className="block text-slate-600">{a.kind} · {a.currency}</small></span><strong className="tabular-nums">{formatMoney(accountBalance(state,a.id),a.currency)}</strong></button>)}
   {selected&&<section className="mt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">{selected.name}</h2><button className="min-h-11 underline" onClick={download}>Export CSV</button><button className="min-h-11 underline" onClick={()=>onAsk(`Reconcile account ${selected.id} (${selected.name}). Ask for my cleared statement balance.`)}>Reconcile</button></div>
    {state.transactions.filter(t=>t.accountId===selected.id&&!t.voided).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(t=><button className="flex min-h-14 w-full justify-between gap-3 border-b border-slate-200 py-3 text-left" key={t.id} onClick={()=>onAsk(`Explain transaction ${t.id} in account ${selected.id}, and help me correct it if needed.`)}><span>{t.payee}<small className="block text-slate-600">{t.date} · {t.cleared?"Cleared":"Uncleared"}</small></span><span className="tabular-nums">{formatMoney(t.amount,selected.currency)}</span></button>)}
   </section>}
  </>}
  {view==="plan"&&<>{summary.map(s=><section key={s.currency} className="mb-6"><h2 className="font-semibold">{s.currency} · {formatMoney(s.readyToAssign,s.currency)} available to assign</h2>{s.categories.map(c=><button key={c.id} className="flex min-h-12 w-full justify-between gap-3 border-b border-slate-200 py-3 text-left" onClick={()=>onAsk(`Review and adjust category ${c.id} (${c.name}) in ${c.currency}.`)}><span>{c.name}</span><span className={c.available<0?"text-red-700 tabular-nums":"tabular-nums"}>{formatMoney(c.available,c.currency)}</span></button>)}</section>)}{state.goals.map(g=><p key={g.id} className="py-2">{g.name} · target {formatMoney(g.target,state.categories.find(c=>c.id===g.categoryId)!.currency)} by {g.targetDate}</p>)}<button className="min-h-11 underline" onClick={()=>onAsk("Help me allocate my available money to categories and savings goals.")}>Plan with SplitFlow</button></>}
  {view==="upcoming"&&<>{!state.schedules.length&&<p>No scheduled costs or income yet.</p>}{state.schedules.map(s=><button key={s.id} className="flex min-h-14 w-full justify-between gap-3 border-b border-slate-200 py-3 text-left" onClick={()=>onAsk(`Review schedule ${s.id} (${s.name}) and its next occurrence.`)}><span>{s.name}<small className="block text-slate-600">{s.frequency} · {s.paused?"Paused":"Expected, not recorded"}</small></span><span>{formatMoney(s.amount,state.accounts.find(a=>a.id===s.accountId)!.currency)}</span></button>)}<button className="min-h-11 underline" onClick={()=>onAsk("Help me schedule a recurring bill or expected income.")}>Add a schedule</button></>}
 </section>;
}
