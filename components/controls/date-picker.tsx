"use client";
import { useLayoutEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => {
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
const display = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
export function DatePicker({
  value,
  onChange,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parse(value));
  const [focused, setFocused] = useState(() => value || iso(new Date()));
  const grid = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  useLayoutEffect(() => {
    if (moving.current) {
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
        ?.focus();
      moving.current = false;
    }
  }, [focused, month]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function focusDate(date: Date) {
    moving.current = true;
    setMonth(date);
    setFocused(iso(date));
  }
  function choose(date: Date) {
    onChange(iso(date));
    setFocused(iso(date));
    setOpen(false);
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMonth(parse(value));
          setFocused(value || iso(new Date()));
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`sf-date-trigger ${className}`}
        >
          <CalendarDays size={16} aria-hidden="true" />
          <span>{value ? display(parse(value)) : "Choose a date"}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="sf-calendar"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={`${label} calendar`}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            grid.current
              ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
              ?.focus();
          }}
        >
          <div className="sf-calendar-heading">
            <strong aria-live="polite">
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                focusDate(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
                )
              }
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                focusDate(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
                )
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            role="grid"
            aria-label="Choose date"
            ref={grid}
            className="sf-calendar-grid"
          >
            <div role="row" className="sf-calendar-week">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <span role="columnheader" key={d}>
                  {d}
                </span>
              ))}
            </div>
            {Array.from(
              { length: Math.ceil((first.getDay() + days) / 7) },
              (_, week) => (
                <div role="row" className="sf-calendar-week" key={week}>
                  {Array.from({ length: 7 }, (_, day) => {
                    const n = week * 7 + day - first.getDay() + 1;
                    if (n < 1 || n > days)
                      return <span role="gridcell" key={day} />;
                    const date = new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        n,
                        12,
                      ),
                      key = iso(date);
                    return (
                      <span
                        role="gridcell"
                        aria-selected={key === value}
                        key={day}
                      >
                        <button
                          type="button"
                          data-date={key}
                          aria-label={display(date)}
                          aria-current={
                            key === iso(new Date()) ? "date" : undefined
                          }
                          tabIndex={key === focused ? 0 : -1}
                          onClick={() => choose(date)}
                          onKeyDown={(e) => {
                            const shifts: Record<string, number> = {
                              ArrowLeft: -1,
                              ArrowRight: 1,
                              ArrowUp: -7,
                              ArrowDown: 7,
                              Home: -date.getDay(),
                              End: 6 - date.getDay(),
                            };
                            if (e.key in shifts) {
                              e.preventDefault();
                              const next = new Date(date);
                              next.setDate(next.getDate() + shifts[e.key]);
                              focusDate(next);
                            } else if (
                              e.key === "PageUp" ||
                              e.key === "PageDown"
                            ) {
                              e.preventDefault();
                              focusDate(
                                new Date(
                                  date.getFullYear(),
                                  date.getMonth() +
                                    (e.key === "PageUp" ? -1 : 1),
                                  1,
                                  12,
                                ),
                              );
                            }
                          }}
                        >
                          {n}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ),
            )}
          </div>
          <div className="sf-calendar-footer">
            <button type="button" onClick={() => choose(new Date())}>
              Today
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
