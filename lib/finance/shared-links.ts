import type { RecordRow } from "@/lib/activity/client";
import { calculateExpense } from "@/lib/pilot/model";
import type { FinanceCommand, FinanceState } from "./model";
/** A private ledger link cannot invent a shared expense or receipt. */
export function validateFinanceLinks(state:FinanceState,command:FinanceCommand,rows:RecordRow[],email:string):void {
 const expenses=rows.filter(row=>row.kind==="activity").flatMap(row=>row.document.expenses);
 const transaction=command.type==="transaction"?command.transaction:command.type==="linkSharedExpense"||command.type==="classifyReimbursement"?state.transactions.find(t=>t.id===command.id):undefined;
 if(!transaction)return;
 const expenseId=command.type==="linkSharedExpense"?command.sharedExpenseId:transaction.sharedExpenseId;
 if(expenseId){
  const expense=expenses.find(e=>e.id===expenseId&&e.expense.participants.some(p=>p.email===email));
  if(!expense)throw Error("Shared expense unavailable.");
  const account=state.accounts.find(a=>a.id===transaction.accountId);
  if(account?.currency!==(expense.expense.currency??"KRW"))throw Error("Linked expense currency must match the account.");
  const paid=expense.expense.participants.find(p=>p.email===email)!.paid;
  const reimbursable=command.type==="linkSharedExpense"?command.reimbursableAmount:transaction.reimbursableAmount??0;
  if(transaction.kind!=="expense"||Math.abs(transaction.amount)!==paid||reimbursable!==Math.max(0,paid-calculateExpense(expense.expense).shares[email]))throw Error("Link the actual paid contribution and its exact recoverable portion.");
 }
 const repaymentId=command.type==="classifyReimbursement"?command.sharedRepaymentId:transaction.sharedRepaymentId;
 if(repaymentId){
  const originalId=command.type==="classifyReimbursement"?command.originalTransactionId:transaction.originalTransactionId;
  const original=state.transactions.find(t=>t.id===originalId);
  const expense=expenses.find(e=>e.id===original?.sharedExpenseId);
  const repayment=expense?.repayments.find(r=>r.id===repaymentId&&r.to===email&&r.status==="confirmed");
  if(!repayment||repayment.amount!==transaction.amount)throw Error("Link a confirmed receipt for this exact incoming amount.");
 }
}
