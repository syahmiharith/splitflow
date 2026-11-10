import { pilotRequest } from "@/lib/pilot/session";
import { emptyFinance, type FinanceState } from "./model";
export const sampleFinanceStorage = (email: string) => `splitflow-private-assistant:sample:${email}`;
export async function loadFinance(guest: boolean, email: string): Promise<{ revision: number; state: FinanceState }> {
  if (!guest) return pilotRequest("/api/workspace/finance");
  const saved = JSON.parse(localStorage.getItem(sampleFinanceStorage(email)) ?? "{}");
  return saved.finance ?? { revision: 0, state: emptyFinance() };
}
