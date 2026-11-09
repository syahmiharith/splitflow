import { database } from "@/lib/pilot/server";
import { emptyFinance, type FinanceState } from "./model";
export async function loadFinance(owner: string): Promise<{ revision: number; state: FinanceState }> {
  const rows = await database(`personal_finance?owner=eq.${encodeURIComponent(owner)}&select=revision,state`);
  return rows[0] ?? { revision: 0, state: emptyFinance() };
}
