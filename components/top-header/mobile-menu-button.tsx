"use client";

import { Menu } from "lucide-react";
import type { DeviceLayoutMode } from "@/lib/use-device-profile";

export function MobileMenuButton({ layoutMode, onMenuClick }: { layoutMode: DeviceLayoutMode; onMenuClick?: () => void }) {
  const menuVisibilityClass = layoutMode === "desktop" ? "hidden" : layoutMode === "unknown" ? "flex md:hidden" : "flex";

  return (
    <div className={`${menuVisibilityClass} items-center`}>
      <button
        type="button"
        onClick={onMenuClick}
        className="grid h-11 w-11 place-items-center rounded-xl text-app-text hover:bg-slate-50"
        aria-label="Open menu"
        data-testid="mobile-sidebar-open"
      >
        <Menu className="h-8 w-8" aria-hidden="true" />
      </button>
    </div>
  );
}
