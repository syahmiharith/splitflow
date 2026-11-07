"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Users, X } from "lucide-react";
import { GroupEditor } from "./group-editor";
import { pilotRequest } from "@/lib/pilot/session";
import type { SavedGroup } from "@/lib/pilot/groups";
export function GroupChooser({
  email,
  seed,
  canUse,
  disabled,
  onUse,
}: {
  email: string;
  seed?: SavedGroup["people"];
  canUse: boolean;
  disabled: boolean;
  onUse: (group: SavedGroup) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<SavedGroup | null | undefined>();
  const [pending, setPending] = useState<{ body: string; key: string }>();
  const guard = useRef(false);
  const storage = `splitflow-pending-group:${email}`;
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setGroups(await pilotRequest("/api/pilot/groups"));
    } catch {
      setError(
        "Couldn’t load saved groups. You can still enter people manually.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function save(
    group: Pick<SavedGroup, "name" | "people">,
    retry = false,
  ) {
    if (guard.current) return;
    guard.current = true;
    setSaving(true);
    setError("");
    const op =
      retry && pending
        ? pending
        : {
            body: JSON.stringify({
              ...group,
              id: editing?.id ?? crypto.randomUUID(),
              expected: editing?.revision ?? 0,
            }),
            key: crypto.randomUUID(),
          };
    setPending(op);
    localStorage.setItem(storage, JSON.stringify(op));
    try {
      const saved: SavedGroup = await pilotRequest("/api/pilot/groups", {
        method: "POST",
        body: JSON.stringify({ ...JSON.parse(op.body), key: op.key }),
      });
      setGroups((rows) => [
        saved,
        ...rows.filter((row) => row.id !== saved.id),
      ]);
      setPending(undefined);
      localStorage.removeItem(storage);
      setEditing(undefined);
      setNotice("Group saved.");
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t save group. Retry this submission.",
      );
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setNotice("");
          setEditing(undefined);
          try {
            const raw = localStorage.getItem(storage);
            setPending(raw ? JSON.parse(raw) : undefined);
          } catch {
            localStorage.removeItem(storage);
          }
          void load();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border-transparent px-2 text-sm font-normal text-app-muted hover:bg-slate-50"
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        Groups
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            aria-label="Saved groups"
            onCancel={(event) => {
              if (saving) event.preventDefault();
              else close();
            }}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
            className="m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-xl bg-white p-0 text-app-text backdrop:bg-black/30"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-app-border bg-white px-5 py-3">
              <h2 className="text-base font-semibold">Saved groups</h2>
              <button
                type="button"
                aria-label="Close saved groups"
                disabled={saving}
                onClick={close}
                className="grid h-11 w-11 place-items-center rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            {loading && (
              <p role="status" className="p-5 text-sm text-app-muted">
                Loading groups…
              </p>
            )}
            {error && (
              <div role="alert" className="px-5 pt-4 text-sm text-red-700">
                {error}
                {!pending && (
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="ml-3 min-h-11 underline"
                  >
                    Reload groups
                  </button>
                )}
              </div>
            )}
            {notice && (
              <p role="status" className="px-5 pt-4 text-sm">
                {notice}
              </p>
            )}
            {pending && !saving && (
              <div className="space-y-2 p-5 text-sm">
                <p>A group save hasn’t been acknowledged.</p>
                <button
                  type="button"
                  onClick={() => void save(JSON.parse(pending.body), true)}
                  className="min-h-11 underline"
                >
                  Retry group save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const unsaved = JSON.parse(pending.body);
                    setPending(undefined);
                    localStorage.removeItem(storage);
                    setLoading(true);
                    void pilotRequest("/api/pilot/groups")
                      .then((rows: SavedGroup[]) => {
                        const current = rows.find(
                          (row) => row.id === unsaved.id,
                        );
                        setGroups(rows);
                        setEditing({
                          ...unsaved,
                          revision: current?.revision ?? 0,
                        });
                        setNotice(
                          current
                            ? `Current saved group: ${current.name} · ${current.people.map((p) => p.name).join(", ")}. Review your retained edits below before saving.`
                            : "Review your retained new group before saving.",
                        );
                        setError("");
                      })
                      .catch(() => {
                        setError(
                          "Couldn’t load current groups. Your edit is retained.",
                        );
                        setPending(pending);
                        localStorage.setItem(storage, JSON.stringify(pending));
                      })
                      .finally(() => setLoading(false));
                  }}
                  className="ml-4 min-h-11 underline"
                >
                  Review retained edit against latest
                </button>
              </div>
            )}
            {editing !== undefined ? (
              <GroupEditor
                key={editing?.id ?? "new"}
                email={email}
                initial={editing ?? undefined}
                seed={seed}
                busy={saving || Boolean(pending)}
                onSave={save}
                onCancel={() => setEditing(undefined)}
              />
            ) : (
              <div className="space-y-4 p-5">
                <p className="text-sm leading-6 text-app-muted">
                  Reuse people for the next dinner. A group is optional and
                  doesn’t change any existing split.
                </p>
                {!canUse && (
                  <p className="text-sm">
                    You can save these people now. Start a new conversation to
                    use a group for another expense.
                  </p>
                )}
                {!loading && groups.length === 0 && !error && (
                  <p className="py-3 text-sm text-app-muted">
                    No saved groups yet.
                  </p>
                )}
                <ul className="divide-y divide-app-border">
                  {groups.map((group) => (
                    <li key={group.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold">
                            {group.name}
                          </h3>
                          <p className="mt-1 text-xs text-app-muted">
                            {group.people.length} people ·{" "}
                            {group.people
                              .map((p) => (p.email === email ? "You" : p.name))
                              .join(", ")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {canUse && (
                            <button
                              type="button"
                              disabled={Boolean(pending)}
                              onClick={() => {
                                setOpen(false);
                                onUse(group);
                              }}
                              className="min-h-11 rounded-lg border border-app-border px-3 text-sm font-semibold"
                            >
                              Use group
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(pending)}
                            aria-label={`Edit ${group.name}`}
                            onClick={() => {
                              setNotice("");
                              setEditing(group);
                            }}
                            className="min-h-11 px-3 text-sm underline"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => {
                    setNotice("");
                    setEditing(null);
                  }}
                  className="min-h-11 rounded-lg border border-app-border px-3 text-sm font-semibold"
                >
                  {seed ? "Save these people as a group" : "New group"}
                </button>
              </div>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}
