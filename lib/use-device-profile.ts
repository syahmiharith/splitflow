"use client";

import { useEffect, useState } from "react";

export type DeviceLayoutMode = "unknown" | "mobile" | "tablet" | "desktop";

export type DeviceProfile = {
  layoutMode: DeviceLayoutMode;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchLike: boolean;
};

const unknownDeviceProfile: DeviceProfile = {
  layoutMode: "unknown",
  isMobile: false,
  isTablet: false,
  isDesktop: false,
  isTouchLike: false
};

const mobileQuery = "(max-width: 767px)";
const tabletQuery = "(min-width: 768px) and (max-width: 1023px)";
const desktopQuery = "(min-width: 1024px)";
const touchQuery = "(pointer: coarse)";

function getDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") {
    return unknownDeviceProfile;
  }

  const isMobileViewport = window.matchMedia(mobileQuery).matches;
  const isTabletViewport = window.matchMedia(tabletQuery).matches;
  const isDesktopViewport = window.matchMedia(desktopQuery).matches;
  const isTouchLike = window.matchMedia(touchQuery).matches;
  const layoutMode: DeviceLayoutMode = isMobileViewport
    ? "mobile"
    : isTabletViewport || isTouchLike
      ? "tablet"
      : isDesktopViewport
        ? "desktop"
        : "mobile";

  return {
    layoutMode,
    isMobile: layoutMode === "mobile",
    isTablet: layoutMode === "tablet",
    isDesktop: layoutMode === "desktop",
    isTouchLike
  };
}

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(unknownDeviceProfile);

  useEffect(() => {
    const queries = [mobileQuery, tabletQuery, desktopQuery, touchQuery].map((query) => window.matchMedia(query));
    const updateProfile = () => setProfile(getDeviceProfile());

    updateProfile();
    queries.forEach((query) => query.addEventListener("change", updateProfile));
    return () => queries.forEach((query) => query.removeEventListener("change", updateProfile));
  }, []);

  return profile;
}
