"use client";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
const DemoShell = dynamic(() => import("@/components/demo-shell"));
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/demo" || pathname.startsWith("/demo/") ? (
    <DemoShell>{children}</DemoShell>
  ) : (
    children
  );
}
