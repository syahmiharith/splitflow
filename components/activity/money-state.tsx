/** A text label is always present: color alone never conveys agreement or receipt. */
export function MoneyState({ children, tone = "neutral" }: {
  children: React.ReactNode; tone?: "neutral" | "positive" | "attention";
}) {
  return <span className={`sf-money-state sf-money-state-${tone}`}>{children}</span>;
}
