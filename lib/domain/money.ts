import type { CurrencyCode } from "@/lib/domain/proposal-types";

export function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number.");
  }
  if (amount < 0) {
    throw new Error("Amount cannot be negative.");
  }
  return Math.round(amount);
}

export function safeRound(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number.");
  }
  return Math.round(amount);
}

export function formatAmount(amount: number, currency: CurrencyCode = "KRW"): string {
  return new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2
  }).format(normalizeAmount(amount));
}

export type RoundingShare = {
  id: string;
  rawAmount: number;
};

export function distributeRoundingRemainderFairly(totalAmount: number, shares: RoundingShare[]): Record<string, number> {
  const normalizedTotal = normalizeAmount(totalAmount);
  if (shares.length === 0) {
    throw new Error("At least one share is required.");
  }

  const floors = shares.map((share, index) => {
    if (!Number.isFinite(share.rawAmount) || share.rawAmount < 0) {
      throw new Error("Share amounts must be non-negative finite numbers.");
    }
    const floor = Math.floor(share.rawAmount);
    return {
      id: share.id,
      index,
      floor,
      fraction: share.rawAmount - floor
    };
  });

  const floorTotal = floors.reduce((sum, share) => sum + share.floor, 0);
  let remainder = normalizedTotal - floorTotal;

  if (remainder < 0) {
    throw new Error("Rounded shares exceed total amount.");
  }

  const ordered = [...floors].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const amounts = Object.fromEntries(floors.map((share) => [share.id, share.floor]));

  let cursor = 0;
  while (remainder > 0) {
    const target = ordered[cursor % ordered.length];
    amounts[target.id] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return amounts;
}
