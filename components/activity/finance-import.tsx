"use client";
import { useState } from "react";
import { Select } from "@/components/controls/select";
import { loadFinance } from "@/lib/finance/client";
import { parseCsv, previewCsv, type CsvPreview, type CsvMapping } from "@/lib/finance/csv";
import type { FinanceCommand } from "@/lib/finance/model";
export function FinanceImport({guest,email,onReview,onClose}:{guest:boolean;email:string;onReview:(commands:FinanceCommand[])=>Promise<unknown>;onClose:()=>void}) {
 const [source,setSource]=useState(""); const [headers,setHeaders]=useState<string[]>([]);
 const [accounts,setAccounts]=useState<{id:string;name:string;currency:string}[]>([]); const [account,setAccount]=useState("");
 const [mapping,setMapping]=useState<CsvMapping>({date:"",payee:"",amount:"",dateFormat:"YYYY-MM-DD",decimal:".",delimiter:","});
 const [candidate,setCandidate]=useState<CsvPreview>(); const [excluded,setExcluded]=useState<string[]>([]);
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 function change(key:keyof CsvMapping,value:string){setCandidate(undefined);setExcluded([]);const next={...mapping,[key]:value} as CsvMapping;setMapping(next);if(key==="delimiter"&&source){try{setHeaders(parseCsv(source,next.delimiter)[0]??[]);}catch(e){setError((e as Error).message);}}}
 async function review(){setBusy(true);setError("");try{const current=await loadFinance(guest,email);const result=await previewCsv(source,mapping,current.state,account);
 if(result.errors.length)throw Error(result.errors.map(e=>`Row ${e.row}: ${e.message}`).slice(0,3).join(" "));
 if(result.possibleMatches.length && !candidate) { setCandidate(result); setExcluded(result.transactions.filter(t => current.state.transactions.some(old => !old.voided && old.accountId === t.accountId && old.date === t.date && old.amount === t.amount)).map(t => t.id)); return; }
 if(!result.transactions.length)throw Error("No new transactions to import. Repeated rows were excluded.");
 localStorage.setItem(`splitflow-csv-mapping:${guest?"sample":"real"}:${email}:${account}`,JSON.stringify(mapping));
 const selected = (candidate?.transactions ?? result.transactions).filter(t => !excluded.includes(t.id));
 if(!selected.length) throw Error("No transactions selected. Possible duplicates remain excluded.");
 if(selected.length>500) throw Error("Review at most 500 transactions per import.");
 await onReview(selected.map(transaction=>({type:"transaction",transaction})));onClose();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="sf-chat-card" aria-label="Import transactions"><div className="flex items-center justify-between"><h2 className="font-semibold">Import transactions</h2><button className="min-h-11 px-2" onClick={onClose}>Close</button></div>
 <label className="block py-3">CSV file<input type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2000000){setError("Choose a CSV smaller than 2 MB.");return;}void file.text().then(async text=>{setCandidate(undefined);setExcluded([]);setSource(text);setHeaders(parseCsv(text,mapping.delimiter)[0]??[]);const f=await loadFinance(guest,email);setAccounts(f.state.accounts.filter(a=>!a.archived));}).catch(e=>setError(e.message));}}/></label>
 {source&&<div className="grid gap-3 sm:grid-cols-2"><label>Account<Select value={account} onChange={e=>{setCandidate(undefined);setExcluded([]);setAccount(e.target.value);const saved=localStorage.getItem(`splitflow-csv-mapping:${guest?"sample":"real"}:${email}:${e.target.value}`);if(saved)setMapping(JSON.parse(saved));}}><option value="">Choose account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</Select></label>
 <label>Separator<Select value={mapping.delimiter} onChange={e=>change("delimiter",e.target.value)}><option value=",">Comma</option><option value=";">Semicolon</option><option value={"\t"}>Tab</option></Select></label>
 {(["date","payee","amount","debit","credit"] as const).map(key=><label key={key}>{key==="date"?"Date column":key==="payee"?"Payee column":key==="amount"?"Signed amount (or use debit/credit)":key==="debit"?"Debit column":"Credit column"}<Select value={mapping[key]??""} onChange={e=>change(key,e.target.value)}><option value="">Choose column</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</Select></label>)}
 <label>Date format<Select value={mapping.dateFormat} onChange={e=>change("dateFormat",e.target.value)}>{["YYYY-MM-DD","DD/MM/YYYY","MM/DD/YYYY"].map(v=><option key={v} value={v}>{v}</option>)}</Select></label>
 <label>Decimal separator<Select value={mapping.decimal} onChange={e=>change("decimal",e.target.value)}><option value=".">Point · 1,234.56</option><option value=",">Comma · 1.234,56</option></Select></label></div>}
 {candidate&&<fieldset className="mt-4"><legend className="font-medium">Review possible duplicates</legend><p className="text-sm text-slate-600">Possible matches start excluded. Select only transactions that are separate records.</p>{candidate.transactions.map(t=><label key={t.id} className="flex min-h-11 items-center gap-3 border-b border-slate-200 py-2"><input type="checkbox" className="h-4 w-4 accent-slate-900" checked={!excluded.includes(t.id)} onChange={e=>setExcluded(ids=>e.target.checked?ids.filter(id=>id!==t.id):[...ids,t.id])}/><span>{t.date} · {t.payee}</span></label>)}</fieldset>}
 {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
 <button className="sf-assistant-confirm mt-4" disabled={busy||!source||!account} onClick={()=>void review()}>{busy?"Preparing…":"Review import"}</button>
 </section>;
}
