import { describe, expect, it } from "vitest";
import { previewCsv, parseCsv, exportTransactions, type CsvMapping } from "@/lib/finance/csv";
import { applyFinanceCommand as apply, emptyFinance } from "@/lib/finance/model";
const mapping: CsvMapping = { date: "Date", payee: "Payee", amount: "Amount", dateFormat: "DD/MM/YYYY", decimal: ".", delimiter: "," };
const state = () => apply(emptyFinance(), { type: "account", account: { id: "bank", name: "Bank", kind: "bank", currency: "USD", openingBalance: 0 } });
describe("reviewed CSV imports", () => {
  it("parses quoted delimiters, escaped quotes and multiline values", () => {
    expect(parseCsv('A,B\r\n"one,two","a""b\nc"')).toEqual([["A", "B"], ["one,two", 'a"b\nc']]);
    expect(() => parseCsv('A\n"unfinished')).toThrow();
  });
  it("uses explicit date/decimal mappings and detects repeated imports", async () => {
    const csv = 'Date,Payee,Amount\n10/11/2026,"Dinner, Seoul",-20.50\n11/11/2026,Income,100.00';
    let s = state(); const result = await previewCsv(csv, mapping, s, "bank");
    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({ amount: -2050, date: "2026-11-10", kind: "expense" });
    for (const transaction of result.transactions) s = apply(s, { type: "transaction", transaction });
    expect((await previewCsv(csv, mapping, s, "bank")).duplicates).toEqual([2, 3]);
  });
  it("flags uncertain matches without silently deleting legitimate same-amount rows", async () => {
    let s = state(); s = apply(s, { type: "transaction", transaction: { id: "old", accountId: "bank", amount: -1000, date: "2026-11-10", kind: "expense", payee: "Dinner" } });
    const result = await previewCsv('Date,Payee,Amount\n10/11/2026,Dinner,-10\n10/11/2026,Dinner,-10', mapping, s, "bank");
    expect(result.possibleMatches).toHaveLength(2);
    expect(result.transactions[0].importKey).not.toBe(result.transactions[1].importKey);
  });
  it("returns validation failures for review and escapes spreadsheet formulas on export", async () => {
    const result = await previewCsv('Date,Payee,Amount\n31/02/2026,Invalid,-1\n10/11/2026,=HYPERLINK("x"),-1', mapping, state(), "bank").catch(() => null);
    expect(result).toBeNull();
    const s = apply(state(), { type: "transaction", transaction: { id: "formula", accountId: "bank", date: "2026-11-10", amount: -100, kind: "expense", payee: "=1+1" } });
    expect(exportTransactions(s, "bank")).toContain("'=1+1");
  });
});
