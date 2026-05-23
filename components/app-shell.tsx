"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MobileSidebarOverlay, Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useDeviceProfile } from "@/lib/use-device-profile";

export function AppShell({ children }: { children: ReactNode }) {
  const device = useDeviceProfile();
  const compactLayout = device.layoutMode !== "desktop";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!compactLayout) {
      setMobileSidebarOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    if (!compactLayout || mobileSidebarOpen) return;

    function onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || touch.clientX > 24) return;
      swipeStart.current = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchEnd(event: TouchEvent) {
      const start = swipeStart.current;
      const touch = event.changedTouches[0];
      swipeStart.current = null;
      if (!start || !touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = Math.abs(touch.clientY - start.y);
      if (deltaX >= 72 && deltaY <= 48) {
        setMobileSidebarOpen(true);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [compactLayout, mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileSidebarOpen]);

  return (
    <div
      className="min-h-screen bg-page text-app-text"
      data-device-layout={device.layoutMode}
      data-pointer={device.isTouchLike ? "coarse" : "fine"}
    >
      <div className="flex min-h-screen">
        <Sidebar layoutMode={device.layoutMode} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader layoutMode={device.layoutMode} onMenuClick={() => setMobileSidebarOpen(true)} />
          <main
            className="min-h-0 flex-1 pb-0"
            data-testid="app-main"
          >
            {children}
          </main>
        </div>
      </div>
      <MobileSidebarOverlay open={compactLayout && mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
    </div>
  );
}
