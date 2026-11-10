import { parseMoney } from "./money";
import { transactionSchema, type FinanceState, type Transaction } from "./model";

export type CsvMapping = { date: string; payee: string; amount?: string; debit?: string; credit?: string; dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY"; decimal: "." | ","; delimiter: "," | ";" | "\t" };
export function parseCsv(text: string, delimiter = ","): string[][] {
  if (text.length > 2_000_000) throw Error("Import at most 2 MB at a time.");
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else if (!quoted && value) throw Error("Invalid CSV quotation."); else quoted = !quoted; }
    else if (!quoted && c === delimiter) { row.push(value); value = ""; }
    else if (!quoted && (c === "\n" || c === "\r")) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(value); if (row.some(v => v.trim())) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (quoted) throw Error("Unclosed CSV quotation.");
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length > 1001) throw Error("Import at most 1,000 transactions at a time.");
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}
function dateValue(value: string, format: CsvMapping["dateFormat"]): string {
  if (format === "YYYY-MM-DD") return value;
  const parts = value.split("/");
  if (parts.length !== 3 || !/^\d{4}$/.test(parts[2])) throw Error("Date does not match the selected format.");
  return `${parts[2]}-${parts[format === "DD/MM/YYYY" ? 1 : 0].padStart(2, "0")}-${parts[format === "DD/MM/YYYY" ? 0 : 1].padStart(2, "0")}`;
}
function numberValue(value: string, decimal: CsvMapping["decimal"]): string {
  const raw = value.trim();
  const pattern = decimal === "." ? /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/ : /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/;
  if (!pattern.test(raw)) throw Error("Amount does not match the selected number format.");
  return decimal === "." ? raw.replaceAll(",", "") : raw.replaceAll(".", "").replace(",", ".");
}
async function fingerprint(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export type CsvPreview = { transactions: Transaction[]; duplicates: number[]; possibleMatches: { row: number; transactionIds: string[] }[]; errors: { row: number; message: string }[] };
/** Returns uncommitted data. A caller must review matches and commit the whole approved batch atomically. */
export async function previewCsv(text: string, mapping: CsvMapping, state: FinanceState, accountId: string): Promise<CsvPreview> {
  const account = state.accounts.find(a => a.id === accountId && !a.archived);
  if (!account) throw Error("Choose an active account.");
  const [headers, ...rows] = parseCsv(text, mapping.delimiter);
  if (!headers || new Set(headers).size !== headers.length) throw Error("CSV needs unique column headers.");
  const required = [mapping.date, mapping.payee, ...(mapping.amount ? [mapping.amount] : [mapping.debit, mapping.credit])];
  if (required.some(h => !h || !headers.includes(h))) throw Error("Map date, payee and either amount or debit/credit columns.");
  const result: CsvPreview = { transactions: [], duplicates: [], possibleMatches: [], errors: [] }, occurrences = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    try {
      if (rows[i].length !== headers.length) throw Error("Column count does not match the header.");
      const get = (key: string) => rows[i][headers.indexOf(key)].trim();
      const parse = (value: string) => parseMoney(numberValue(value, mapping.decimal), account.currency);
      let amount: number;
      if (mapping.amount) amount = parse(get(mapping.amount));
      else {
        const debit = get(mapping.debit!), credit = get(mapping.credit!);
        const out = debit ? parse(debit) : 0, incoming = credit ? parse(credit) : 0;
        if (out < 0 || incoming < 0 || (out && incoming)) throw Error("Use one nonnegative debit or credit amount per row.");
        amount = incoming - out;
      }
      const transaction = transactionSchema.parse({ id: crypto.randomUUID(), accountId, date: dateValue(get(mapping.date), mapping.dateFormat), amount, kind: amount > 0 ? "income" : "expense", payee: get(mapping.payee), cleared: true, splits: [] });
      const normalized = JSON.stringify([accountId, transaction.date, transaction.amount, transaction.payee]);
      const count = occurrences.get(normalized) ?? 0; occurrences.set(normalized, count + 1);
      transaction.importKey = await fingerprint(`${normalized}:${count}`);
      if (state.transactions.some(t => t.importKey === transaction.importKey)) { result.duplicates.push(i + 2); continue; }
      const matches = state.transactions.filter(t => !t.voided && t.accountId === accountId && t.amount === amount && t.date === transaction.date).map(t => t.id);
      if (matches.length) result.possibleMatches.push({ row: i + 2, transactionIds: matches });
      result.transactions.push(transaction);
    } catch (error) { result.errors.push({ row: i + 2, message: error instanceof Error ? error.message : "Invalid row." }); }
  }
  return result;
}
export function exportTransactions(state: FinanceState, accountId: string): string {
  const escape = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) throw Error("Account unavailable.");
  return ["id,date,payee,amount_minor,currency,cleared,voided", ...state.transactions.filter(t => t.accountId === accountId).map(t => [t.id, t.date, /^[=+@-]/.test(t.payee) ? `'${t.payee}` : t.payee, t.amount, account.currency, t.cleared, t.voided ?? ""].map(escape).join(","))].join("\r\n");
}
