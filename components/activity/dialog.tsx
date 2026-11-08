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
      className="m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-xl p-0 backdrop:bg-black/30"
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
