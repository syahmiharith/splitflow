"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MobileSidebarOverlay, Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useDeviceProfile } from "@/lib/use-device-profile";

export function AppShell({ children }: { children: ReactNode }) {
  const device = useDeviceProfile();
  const compactLayout = device.layoutMode !== "desktop";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
    window.localStorage.setItem("splitflow-edge-swipe-hint-dismissed", "true");
  }, []);

  useEffect(() => {
    if (!compactLayout) {
      setMobileSidebarOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    if (!compactLayout || mobileSidebarOpen) {
      setShowSwipeHint(false);
      return;
    }

    if (window.localStorage.getItem("splitflow-edge-swipe-hint-dismissed") === "true") return;
    setShowSwipeHint(true);
    const timer = window.setTimeout(dismissSwipeHint, 7000);
    return () => window.clearTimeout(timer);
  }, [compactLayout, mobileSidebarOpen, dismissSwipeHint]);

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
        dismissSwipeHint();
        setMobileSidebarOpen(true);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [compactLayout, mobileSidebarOpen, dismissSwipeHint]);

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
      {compactLayout && !mobileSidebarOpen ? (
        <button
          type="button"
          onClick={() => {
            dismissSwipeHint();
            setMobileSidebarOpen(true);
          }}
          className="fixed left-0 top-[46vh] z-40 flex min-h-14 max-w-[150px] -translate-y-1/2 items-center gap-2 rounded-r-full border border-l-0 border-blue-100 bg-white/95 px-2.5 py-2 text-xs font-semibold text-app-blue shadow-soft transition-opacity duration-300"
          data-testid="mobile-swipe-hint"
          aria-label="Open sidebar. You can also swipe from the left edge."
        >
          <span className="h-8 w-1 rounded-full bg-app-blue" aria-hidden="true" />
          <span className={showSwipeHint ? "block" : "sr-only"}>Swipe from edge</span>
        </button>
      ) : null}
      <MobileSidebarOverlay open={compactLayout && mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
    </div>
  );
}
