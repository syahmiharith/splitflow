"use client";
import Link from "next/link";
import {
  FileText,
  Home,
  LogOut,
  Plus,
  Waypoints,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

const navigation = [
  { href: "/", label: "Home", key: "home", icon: Home },
  { href: "/?view=splits", label: "Splits", key: "splits", icon: FileText },
  { href: "/?view=new", label: "New split", key: "new", icon: Plus },
];
export function WorkspaceFrame({
  children,
  active,
  title,
  email,
  onSignOut,
  viewKey,
}: {
  children: ReactNode;
  active: string;
  title: string;
  email?: string;
  onSignOut: () => void;
  viewKey: string;
}) {
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [viewKey]);
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-page text-app-text"
      data-testid="signed-workspace"
    >
      <a
        href="#workspace-content"
        className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>
      <div className="flex min-h-0 flex-1">
        <aside
          className="hidden w-[280px] shrink-0 flex-col border-r border-app-border bg-white lg:flex"
          aria-label="Workspace sidebar"
        >
          <Link
            href="/"
            className="flex h-[92px] shrink-0 items-center gap-3 border-b border-app-border px-6"
            aria-label="SplitFlow home"
          >
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-app-blue">
              <Waypoints className="h-7 w-7" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-2xl font-bold tracking-tight">
                SplitFlow
              </span>
              <span className="block text-xs text-app-muted">
                Shared expenses, made clear
              </span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex-1 px-3 py-5">
            <p className="px-5 pb-3 text-xs font-semibold uppercase tracking-wide text-app-muted">
              Workspace
            </p>
            {navigation.map(({ icon: Icon, ...item }) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                className={`relative mb-1 flex min-h-12 items-center gap-3 rounded-lg px-5 text-sm font-semibold ${active === item.key ? "bg-blue-50 text-app-blue" : "hover:bg-slate-50"}`}
              >
                {active === item.key && (
                  <span className="absolute left-0 h-8 w-1 rounded-r bg-app-blue" />
                )}
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-4 border-t border-app-border p-5">
            <Link
              href="/demo"
              className="flex min-h-11 items-center justify-between rounded-lg border border-app-border px-3 text-sm font-semibold text-app-muted hover:bg-slate-50"
            >
              Try demo
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {email ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-app-muted">
                  Signed in
                </p>
                <p className="break-all text-sm">{email}</p>
                <button
                  onClick={onSignOut}
                  className="flex min-h-11 items-center gap-2 text-sm text-app-muted"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : (
              <p className="text-xs leading-5 text-app-muted">
                Sign in to create a split or review an invitation.
              </p>
            )}
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-3 border-b border-app-border bg-white px-4 py-4 md:px-6 lg:px-8">
            <div className="min-w-0">
              <Link
                href="/"
                className="mb-1 flex items-center gap-2 text-sm font-bold text-app-blue lg:hidden"
              >
                <Waypoints className="h-5 w-5" aria-hidden="true" />
                SplitFlow
              </Link>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                {title}
              </h1>
              <p className="mt-1 hidden text-sm text-app-muted sm:block">
                Clear shares. Simple repayments.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/demo"
                className="rounded-lg px-2 py-3 text-sm font-semibold text-app-muted lg:hidden"
              >
                Try demo
              </Link>
              {email ? (
                <>
                  <button
                    onClick={onSignOut}
                    aria-label="Sign out"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-app-border text-app-muted lg:hidden"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {active !== "new" && (
                    <Link
                      href="/?view=new"
                      className="hidden min-h-11 items-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 sm:inline-flex"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New split
                    </Link>
                  )}
                </>
              ) : (
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-app-muted sm:block">
                  Your workspace
                </span>
              )}
            </div>
          </header>
          <main
            ref={content}
            id="workspace-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
            data-testid="app-route-scroll"
          >
            <div className="mx-auto w-full max-w-6xl px-4 py-5 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <nav
        aria-label="Primary navigation"
        className="grid shrink-0 grid-cols-3 border-t border-app-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {navigation.map(({ icon: Icon, ...item }) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={`flex min-h-[68px] flex-col items-center justify-center gap-1 text-xs font-semibold ${active === item.key ? "text-app-blue" : "text-app-muted"}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
