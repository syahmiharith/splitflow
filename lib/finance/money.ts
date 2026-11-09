const codes = new Set(Intl.supportedValuesOf("currency"));
export function currencyMinorUnits(currency: string): number {
  if (!codes.has(currency)) throw Error("Choose a supported ISO currency.");
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits!;
}
/** Parse decimal text without binary floating-point rounding. */
export function parseMoney(value: string, currency: string): number {
  const digits = currencyMinorUnits(currency);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[3]?.length ?? 0) > digits) throw Error(`Use at most ${digits} decimal places for ${currency}.`);
  const units = BigInt(match[2]) * 10n ** BigInt(digits) + BigInt((match[3] ?? "").padEnd(digits, "0") || "0");
  const amount = Number(match[1] ? -units : units);
  if (!Number.isSafeInteger(amount)) throw Error("Amount is too large.");
  return amount;
}
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 10 ** currencyMinorUnits(currency));
}
export function sumMoney(amounts: number[]): number {
  const sum = amounts.reduce((total, amount) => total + BigInt(amount), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER)) throw Error("Total is too large.");
  return Number(sum);
}
