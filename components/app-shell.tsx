"use client";

import type { ReactNode } from "react";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-app-text">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />
          <main className="min-h-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0" data-testid="app-main">
            {children}
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
