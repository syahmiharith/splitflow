"use client";
import { useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
export function ProfileMenu({ name, subtitle, people, email, onSelect, children }: {
  name: string; subtitle: string; people?: { name: string; email: string }[]; email: string;
  onSelect: (email: string) => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><button type="button" aria-label={people ? "Sample person" : "Account options"} className="sf-profile-trigger">
      <span className="sf-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <span className="sf-profile-copy"><span>{name}</span><small>{subtitle}</small></span>
      <ChevronsUpDown size={15} aria-hidden="true" />
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content side="top" align="start" sideOffset={8} collisionPadding={12} className="sf-profile-menu" aria-label="Profile and account" onOpenAutoFocus={(e) => {
      if (people) { e.preventDefault(); list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus(); }
    }}>
      {people && <><p className="sf-profile-caption">Switch sample person</p><div role="listbox" aria-label="Sample people" ref={list} onKeyDown={e => {
        const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        let next = -1;
        if(e.key === "ArrowDown") next = (index + 1) % options.length;
        else if(e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
        else if(e.key === "Home") next = 0;
        else if(e.key === "End") next = options.length - 1;
        else if(e.key.length === 1 && e.key !== " ") next = people.findIndex(p => p.name.toLowerCase().startsWith(e.key.toLowerCase()));
        if(next >= 0) { e.preventDefault(); options[next]?.focus(); }
      }}>{people.map(person => <button type="button" role="option" aria-selected={person.email === email} key={person.email} className="sf-profile-option" onClick={() => { onSelect(person.email); setOpen(false); }}>
        <span className="sf-avatar" aria-hidden="true">{person.name.slice(0,1)}</span><span>{person.name}</span>{person.email === email && <Check size={15} aria-hidden="true" />}
      </button>)}</div><div className="sf-profile-divider" /></>}
      <div className="sf-profile-actions" onClick={() => setOpen(false)}>{children}</div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
