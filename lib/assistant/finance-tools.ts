import { z } from "zod";
import { accountBalance, applyFinanceCommand, categoryAvailable, financeSummary, today, nextOccurrence, type FinanceCommand, type FinanceState } from "@/lib/finance/model";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import type { Preview } from "./model";
export type FinanceSnapshot = { revision: number; state: FinanceState };
export const financeReadParameters = {
  type: "object", properties: {
    kind: {type:"string",enum:["summary","accounts","transactions","categories","goals","schedules","reconciliations","export"]},
    query: {type:["string","null"],description:"Optional text search; do not put an account ID here."}, recordId:{type:["string","null"],description:"Exact ID of the requested record kind: a transaction ID for transactions, a schedule ID for schedules, an account ID for accounts/export. Not an account filter."}, accountId:{type:["string","null"],description:"Filter transactions, schedules or reconciliations by their authorized owning account. Null for other kinds."}, cursor:{type:["string","null"]}, currency:{type:["string","null"]}, month:{type:["string","null"]},
  }, required:["kind","query","recordId","accountId","cursor","currency","month"],additionalProperties:false,
};
const readSchema=z.object({kind:z.enum(["summary","accounts","transactions","categories","goals","schedules","reconciliations","export"]),query:z.string().max(300).nullable().optional(),recordId:z.string().max(100).nullable().optional(),accountId:z.string().min(1).max(100).nullable().optional(),cursor:z.string().max(2000).nullable().optional(),currency:z.string().length(3).nullable().optional(),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional()}).strict();
export function readFinance(raw:unknown,snapshot:FinanceSnapshot) {
  const args=readSchema.parse(raw), state=snapshot.state;
  if(args.accountId){
    if(!state.accounts.some(account=>account.id===args.accountId))throw Error("Account unavailable. Choose an account returned by read_finance accounts.");
    if(!["transactions","schedules","reconciliations"].includes(args.kind))throw Error("accountId filters transactions, schedules and reconciliations only. For an exact account or export use recordId.");
  }
  if(["transactions","schedules","reconciliations"].includes(args.kind)&&args.recordId&&state.accounts.some(account=>account.id===args.recordId))throw Error("recordId is an account ID, not a record of the requested kind. Retry with accountId set to that account ID and recordId null.");
  if(args.kind==="summary" && (args.query || args.recordId || args.cursor)) throw Error("Summary supports currency and month filters only. Use a record search for specific entries.");
  if(args.kind==="export") {
    const account=state.accounts.find(a=>a.id===args.recordId);
    if(!account)throw Error("Choose an account from your personal records before exporting.");
    if(args.query||args.cursor||args.month||args.currency&&args.currency!==account.currency)throw Error("Account export contains the full recorded account history. Filtered exports are not available.");
    return {revision:snapshot.revision,account:{id:account.id,name:account.name,currency:account.currency},handoff:{href:`/?finance=${encodeURIComponent(account.id)}`,label:`Open ${account.name} for CSV export`,nextAction:"Open this account and select Export CSV."},downloadStarted:false,instruction:"Show the handoff link. A download starts only when the user selects Export CSV; do not claim a file was downloaded or attached."};
  }
  if(args.kind==="summary") {
    const currentDate=today(), month=args.month??currentDate.slice(0,7);
    const summaries=financeSummary(state,month).filter(s=>!args.currency||s.currency===args.currency);
    if(month!==currentDate.slice(0,7))return {revision:snapshot.revision,complete:true,balanceAsOf:currentDate,categoryThroughMonth:month,historicalCashSupported:false,instruction:"Account cash, liabilities, reserves and receivables are CURRENT, not historical. Only category values reflect the requested month. No historical ready-to-assign total is supplied.",currencies:summaries.map(s=>({currency:s.currency,currentCash:s.cash,currentCreditLiability:s.creditLiability,currentCardPaymentAllocation:s.cardPaymentAllocation,currentReceivable:s.receivable,categories:s.categories}))};
    return {revision:snapshot.revision,complete:true,balanceAsOf:currentDate,categoryThroughMonth:month,currencies:summaries};
  }
  const data:Record<string,unknown>[] = state[args.kind].map(row=>({...row}));
  const accountRecords=data.filter(row=>!args.accountId||row.accountId===args.accountId);
  const filtered=accountRecords.filter(row=>{
    const currency=row.currency??state.accounts.find(a=>a.id===row.accountId)?.currency??state.categories.find(c=>c.id===row.categoryId)?.currency;
    return (!args.currency||currency===args.currency)&&(!args.recordId||row.id===args.recordId)&&(!args.month||typeof row.date!=="string"||row.date.startsWith(args.month))&&(!args.query||JSON.stringify(row).toLocaleLowerCase("en-US").includes(args.query.toLocaleLowerCase("en-US")));
  });
  // Bind pagination to both immutable revision and filters; never accept a different query's cursor.
  const signature=encodeURIComponent(JSON.stringify([args.kind,args.query??null,args.recordId??null,args.accountId??null,args.currency??null,args.month??null]));
  const stamp=`${snapshot.revision}:${signature}`;
  const offset=args.cursor?Number(args.cursor.split(":")[0]):0;
  if(args.cursor&&(!Number.isSafeInteger(offset)||offset<0||offset>filtered.length||args.cursor.slice(args.cursor.indexOf(":")+1)!==stamp)) throw Error("Finance records changed or cursor is invalid. Restart the search.");
  const page=filtered.slice(offset,offset+20).map(row=>args.kind==="schedules"?{...row,nextOccurrence:nextOccurrence(row as FinanceState["schedules"][number]),statusMeaning:"Expected occurrence only; not a recorded expense or payment"}:args.kind==="accounts"?{...row,balanceAsOf:today(),balance:accountBalance(state,String(row.id)),clearedBalance:accountBalance(state,String(row.id),true)}:args.kind==="categories"?{...row,available:categoryAvailable(state,String(row.id),args.month??undefined)}:row);
  const nextCursor=offset+page.length<filtered.length?`${offset+page.length}:${stamp}`:null;
  return {revision:snapshot.revision,records:page,matchedCount:filtered.length,nextCursor,complete:!nextCursor&&offset===0,
    scope:{kind:args.kind,accountId:args.accountId??null,recordId:args.recordId??null,query:args.query??null,currency:args.currency??null,month:args.month??null},
    ...(!filtered.length&&accountRecords.length?{otherRecordsExist:true,instruction:"No records match these filters, but other authorized records exist in this account scope. Do not say the account or workspace has no records. If the user did not specify these date or text restrictions, retry without them."}:{})};
}
export function financePreview(before:FinanceState,command:FinanceCommand):{state:FinanceState;preview:Preview} {
  const state=applyFinanceCommand(before,command);
  const accountId="accountId" in command?command.accountId:command.type==="transaction"?command.transaction.accountId:undefined;
  const account=state.accounts.find(a=>a.id===accountId);
  const categoryId="categoryId" in command?command.categoryId:undefined;
  const category=state.categories.find(c=>c.id===categoryId);
  const labels:Record<FinanceCommand["type"],string>={rename:"Rename record",account:"Create account",category:"Create category",transaction:"Record transaction",voidTransaction:"Void transaction",voidTransfer:"Void transfer",linkSharedExpense:"Link shared expense",classifyReimbursement:"Classify reimbursement",categorize:"Change categories",clear:"Update cleared status",transfer:"Record transfer",allocate:"Adjust allowance",allocateCardPayment:"Adjust card payment allocation",goal:"Save goal",schedule:"Save recurring cost",pauseSchedule:"Update schedule",skipOccurrence:"Skip occurrence",recordOccurrence:"Record actual cost",reconcile:"Reconcile account",archive:"Update archive status"};
  let title=labels[command.type];
  const lines:string[]=[];
  switch(command.type){
    case "account": title=command.account.name;lines.push(`Opening balance ${formatMoney(command.account.openingBalance,command.account.currency)}`,`${command.account.kind} account · recorded only`);break;
    case "category":title=command.category.name;lines.push(`Category · ${command.category.currency}`);break;
    case "transaction":title=command.transaction.payee;lines.push(`${formatMoney(command.transaction.amount,account!.currency)} · ${account!.name}`,command.transaction.date,command.transaction.cleared?"Cleared record":"Uncleared record",...command.transaction.splits.map(split=>`${state.categories.find(category=>category.id===split.categoryId)!.name}: ${formatMoney(split.amount,account!.currency)}`));break;
    case "allocate":title=category!.name;lines.push(`${formatMoney(categoryAvailable(before,category!.id,command.month),category!.currency)} → ${formatMoney(categoryAvailable(state,category!.id,command.month),category!.currency)}`,`Allowance · ${command.month}`);break;
    case "transfer":{const from=state.accounts.find(a=>a.id===command.from)!,to=state.accounts.find(a=>a.id===command.to)!;lines.push(`${from.name}: ${formatMoney(command.sourceAmount,from.currency)} → ${to.name}: ${formatMoney(command.destinationAmount,to.currency)}`,`Fee ${formatMoney(command.fee,from.currency)}`,"Records an external transfer; does not move money.");break;}
    case "reconcile":title=account!.name;lines.push(`Cleared ${formatMoney(accountBalance(before,account!.id,true),account!.currency)} → ${formatMoney(command.statedBalance,account!.currency)}`,command.reason);break;
    case "goal":title=command.name;lines.push(`${formatMoney(command.target,category!.currency)} by ${command.targetDate}`);break;
    case "schedule":{const a=state.accounts.find(a=>a.id===command.schedule.accountId)!;title=command.schedule.name;lines.push(`${formatMoney(command.schedule.amount,a.currency)} · ${command.schedule.frequency}`,`Starts ${command.schedule.start} · expected, not recorded spending`, `Account: ${a.name}`, ...(command.schedule.categoryId ? [`Category: ${state.categories.find(c=>c.id===command.schedule.categoryId)!.name}`] : []));break;}
    case "allocateCardPayment":lines.push(`${account!.name}: ${formatMoney(before.cardPayments[account!.id]??0,account!.currency)} → ${formatMoney(state.cardPayments[account!.id]??0,account!.currency)}`);break;
    case "linkSharedExpense":case "classifyReimbursement":{const t=state.transactions.find(t=>t.id===command.id)!,a=state.accounts.find(a=>a.id===t.accountId)!;title=t.payee;lines.push(`${formatMoney(t.amount,a.currency)} · ${a.name}`,command.type==="linkSharedExpense"?`Reimbursable ${formatMoney(command.reimbursableAmount,a.currency)} · own spending ${formatMoney(Math.abs(t.amount)-command.reimbursableAmount,a.currency)}`:"Reimbursement of linked shared spending; not new income");break;}
    case "voidTransfer":{const entries=before.transactions.filter(t=>t.transferId===command.id&&!t.voided);title="Void transfer";lines.push(...entries.map(t=>`${state.accounts.find(a=>a.id===t.accountId)!.name}: ${formatMoney(t.amount,state.accounts.find(a=>a.id===t.accountId)!.currency)}`),command.reason);break;}
    case "voidTransaction":case "clear":case "categorize":{const t=state.transactions.find(t=>t.id===command.id)!,a=state.accounts.find(a=>a.id===t.accountId)!;title=t.payee;lines.push(`${formatMoney(t.amount,a.currency)} · ${a.name}`);if(command.type==="voidTransaction")lines.push(command.reason);else if(command.type==="clear")lines.push(command.cleared?"Cleared":"Uncleared");else lines.push(...command.splits.map(s=>`${state.categories.find(c=>c.id===s.categoryId)!.name}: ${formatMoney(s.amount,a.currency)}`));break;}
    case "pauseSchedule":case "skipOccurrence":case "recordOccurrence":{const schedule=state.schedules.find(s=>s.id===command.id)!,a=state.accounts.find(a=>a.id===schedule.accountId)!;title=schedule.name;if(command.type==="pauseSchedule")lines.push(command.paused?"Paused":"Resumed");else if(command.type==="skipOccurrence")lines.push(`Skip ${command.date}`);else lines.push(`${formatMoney(command.actualAmount,a.currency)} · ${command.actualDate}`,`For occurrence ${command.date}`);break;}
    case "archive":{const record=command.kind==="account"?state.accounts.find(a=>a.id===command.id)!:state.categories.find(c=>c.id===command.id)!;title=record.name;lines.push(command.archived?"Archived":"Restored");break;}
    case "rename":{const old=command.kind==="account"?before.accounts.find(a=>a.id===command.id)!:before.categories.find(c=>c.id===command.id)!;title=command.name;lines.push(`${old.name} → ${command.name}`);break;}
  }
  return {state,preview:{title,entity:financeEntity(command),summary:{text:lines[0]??labels[command.type]},lines:[labels[command.type],...lines]}};
}

function financeEntity(command: FinanceCommand): NonNullable<Preview["entity"]> {
  switch (command.type) {
    case "account": return { kind: "account", id: command.account.id };
    case "category": return { kind: "category", id: command.category.id };
    case "transaction": return { kind: "transaction", id: command.transaction.id };
    case "allocate": return { kind: "category", id: command.categoryId };
    case "allocateCardPayment": case "reconcile": return { kind: "account", id: command.accountId };
    case "goal": return { kind: "goal", id: command.id };
    case "schedule": return { kind: "schedule", id: command.schedule.id };
    case "pauseSchedule": case "skipOccurrence": case "recordOccurrence": return { kind: "schedule", id: command.id };
    case "archive": case "rename": return { kind: command.kind, id: command.id };
    case "voidTransaction": case "voidTransfer": case "transfer": case "categorize": case "clear": case "linkSharedExpense": case "classifyReimbursement": return { kind: "transaction", id: command.id };
  }
}

/** Manual import/review uses exactly the same deterministic command previews. */
export function prepareFinanceCommands(snapshot:FinanceSnapshot,commands:FinanceCommand[]) {
  let state=snapshot.state;
  const previews:Preview[]=[];
  for(const command of commands){const result=financePreview(state,command);state=result.state;previews.push(result.preview);}
  if(commands.length > 5 && commands.every(command=>command.type === "transaction")) {
    const transactions=commands.map(command=>command.transaction);
    const currencies=[...new Set(transactions.map(t=>state.accounts.find(a=>a.id===t.accountId)!.currency))];
    const totals=currencies.map(currency=>{const entries=transactions.filter(t=>state.accounts.find(a=>a.id===t.accountId)!.currency===currency);return `${currency}: ${formatMoney(sumMoney(entries.filter(t=>t.amount>0).map(t=>t.amount)),currency)} in · ${formatMoney(-sumMoney(entries.filter(t=>t.amount<0).map(t=>t.amount)),currency)} out`;});
    return {expected:snapshot.revision,commands,previews:[{title:`${transactions.every(t=>t.importKey)?"Import":"Record"} ${transactions.length} transactions`,summary:{text:totals.join("; ")},lines:[...totals,...transactions.map(t=>`${t.date} · ${t.payee} · ${formatMoney(t.amount,state.accounts.find(a=>a.id===t.accountId)!.currency)}`)]}]};
  }
  return {expected:snapshot.revision,commands,previews};
}
