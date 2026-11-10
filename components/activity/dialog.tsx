"use client";
import { Dialog } from "@/components/controls/dialog";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
export function ActivityDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      drawer={title === "Navigation"}
    >
      <header className="sf-dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="sf-dialog-close"
        >
          <X size={18} />
        </button>
      </header>
      <div className="sf-dialog-body">{children}</div>
    </Dialog>
  );
}

export function ActivityPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement;
    heading.current?.focus();
    const main = heading.current?.closest("main");
    if (main && heading.current)
      main.scrollTop +=
        heading.current.getBoundingClientRect().top -
        main.getBoundingClientRect().top -
        24;
    return () => previous?.focus();
  }, []);
  return (
    <section
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="sf-inline-panel max-w-full"
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1
          ref={heading}
          tabIndex={-1}
          className={
            title === "Recurring schedule" || title === "New activity"
              ? "sf-flow-label outline-none"
              : "text-xl font-semibold tracking-tight outline-none"
          }
        >
          {title}
        </h1>
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
          className="min-h-11 rounded-lg px-3 text-sm hover:bg-slate-100"
        >
          Close
        </button>
      </header>
      {children}
    </section>
  );
}
