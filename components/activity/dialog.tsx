"use client";
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
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-label={title}
      className={title === "Navigation" ? "sf-nav-drawer" : "m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-xl p-0 backdrop:bg-black/30"}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="h-11 w-11"
        >
          ✕
        </button>
      </header>
      <div className="p-5">{children}</div>
    </dialog>
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
    if (main && heading.current) main.scrollTop += heading.current.getBoundingClientRect().top - main.getBoundingClientRect().top - 24;
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
          className="text-xl font-semibold tracking-tight outline-none"
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
