type KpiTone = "green" | "amber" | "violet" | "blue";

const toneClass: Record<KpiTone, string> = {
  green: "text-app-green",
  amber: "text-app-amber",
  violet: "text-app-violet",
  blue: "text-app-blue"
};

export function KpiChip({ label, value, tone }: { label: string; value: number | string; tone: KpiTone }) {
  return (
    <div className="min-w-0 rounded-lg border border-app-border bg-white px-3 py-2 text-center" data-testid={`kpi-${label.toLowerCase()}`}>
      <div className={`text-xs font-semibold ${toneClass[tone]}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold leading-none ${toneClass[tone]}`}>{value}</div>
    </div>
  );
}
