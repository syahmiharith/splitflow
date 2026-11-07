"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function LegacyPilotPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${location.search}${location.hash}`);
  }, [router]);
  return <p className="p-8 text-app-muted">Opening SplitFlow…</p>;
}
