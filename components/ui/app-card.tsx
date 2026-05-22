import type { ReactNode } from "react";

type AppCardProps = {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
};

export function AppCard({ children, className = "", "data-testid": testId }: AppCardProps) {
  return (
    <section
      data-testid={testId}
      className={`rounded-2xl border border-app-border bg-white shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:rounded-lg ${className}`}
    >
      {children}
    </section>
  );
}
