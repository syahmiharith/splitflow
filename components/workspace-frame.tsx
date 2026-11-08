"use client";
import Link from "next/link";
import {
  FileText,
  LogOut,
  MessageSquare,
  Plus,
  Waypoints,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Conversation } from "@/lib/pilot/conversation";
const navigation = [
  {
    href: "/?legacy=1",
    label: "New conversation",
    key: "home",
    icon: MessageSquare,
  },
  {
    href: "/?view=splits",
    label: "Your splits",
    key: "splits",
    icon: FileText,
  },
];
export function WorkspaceFrame({
  children,
  active,
  title,
  email,
  onSignOut,
  viewKey,
  conversations = [],
  currentConversation,
  conversationMode = false,
}: {
  children: ReactNode;
  active: string;
  title: string;
  email?: string;
  onSignOut: () => void;
  viewKey: string;
  conversations?: Conversation[];
  currentConversation?: string;
  conversationMode?: boolean;
}) {
  const content = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [viewKey]);
  useEffect(() => {
    if (menuOpen) menu.current?.showModal();
    else menu.current?.close();
  }, [menuOpen]);
  function sidebar() {
    return (
      <>
        <Link
          href="/"
          aria-label="SplitFlow home"
          className="flex min-h-20 items-center gap-2 px-5 text-xl font-semibold tracking-tight"
        >
          <Waypoints className="h-6 w-6 text-app-blue" aria-hidden="true" />
          SplitFlow
        </Link>
        <nav aria-label="Main navigation" className="space-y-1 px-3">
          {navigation.map(({ icon: Icon, ...item }) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={
                active === item.key && !currentConversation ? "page" : undefined
              }
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${active === item.key && !currentConversation ? "bg-slate-200/60 font-medium" : "hover:bg-slate-200/40"}`}
            >
              <Icon className="h-4 w-4 text-app-muted" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-7">
          <p className="px-3 pb-2 text-xs text-app-muted">Conversations</p>
          {conversations.length ? (
            <nav aria-label="Saved conversations">
              {conversations.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/?conversation=${chat.id}`}
                  aria-current={
                    currentConversation === chat.id ? "page" : undefined
                  }
                  className={`mb-1 block truncate rounded-lg px-3 py-3 text-sm ${currentConversation === chat.id ? "bg-slate-200/60" : "hover:bg-slate-200/40"}`}
                >
                  {chat.title}
                </Link>
              ))}
            </nav>
          ) : (
            <p className="px-3 text-xs leading-5 text-app-muted">
              Your saved conversations will appear here.
            </p>
          )}
        </div>
        <div className="space-y-3 p-5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 text-sm text-app-muted"
          >
            Activities
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {email ? (
            <div>
              <p className="truncate text-xs text-app-muted" title={email}>
                {email}
              </p>
              <button
                onClick={onSignOut}
                className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : (
            <p className="text-xs text-app-muted">
              Sign in to save your conversations.
            </p>
          )}
        </div>
      </>
    );
  }
  return (
    <div
      className="flex h-dvh overflow-hidden bg-white text-app-text"
      data-testid="signed-workspace"
    >
      <a
        href="#workspace-content"
        className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>
      <aside
        className="hidden w-60 shrink-0 flex-col bg-slate-50 lg:flex"
        aria-label="Workspace sidebar"
      >
        {sidebar()}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-medium">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {email && (
              <Link
                href="/?view=new"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-app-muted hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">New split</span>
                <span className="sr-only sm:hidden">New split</span>
              </Link>
            )}
            {email && (
              <button
                onClick={onSignOut}
                aria-label="Sign out"
                className="grid h-11 w-11 place-items-center lg:hidden"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
            {!email && (
              <Link
                href="/"
                className="min-h-11 py-3 text-sm text-app-muted lg:hidden"
              >
                Activities
              </Link>
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
          <div
            className={
              conversationMode
                ? "h-full"
                : "mx-auto w-full max-w-5xl px-4 py-5 md:p-6"
            }
          >
            {children}
          </div>
        </main>
      </div>
      <dialog
        aria-label="Navigation"
        ref={menu}
        onCancel={() => setMenuOpen(false)}
        onClose={() => setMenuOpen(false)}
        className="m-0 h-dvh max-h-none w-72 max-w-[90vw] bg-slate-50 p-0 text-app-text backdrop:bg-black/30"
      >
        <div className="flex h-full flex-col">
          <button
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
          {sidebar()}
        </div>
      </dialog>
    </div>
  );
}
