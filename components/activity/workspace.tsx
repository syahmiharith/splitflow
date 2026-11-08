"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Menu,
  Users,
  ArrowUp,
  ChevronDown,
  PanelLeft,
  SquarePen,
  Search,
  Receipt,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { clearSession, getSession } from "@/lib/pilot/session";
import {
  loadWorkspace,
  writeWorkspace,
  samplePeople,
  resetSample,
  type RecordRow,
  type Operation,
} from "@/lib/activity/client";
import type { Activity, SharedGroup, Person } from "@/lib/activity/model";
import { balances, type Expense, type Split } from "@/lib/pilot/model";
import { ActivityShare } from "./share";
import { NewActivityForm, ScheduleForm } from "./activity-setup";
import { GroupEditor } from "@/components/group-editor";
import { ActivityDialog, ActivityPanel } from "./dialog";
import { ActivitySignIn } from "./sign-in";
import { ExpenseCard, money } from "./expense-card";
import { RecurringTerms } from "./recurring-terms";
import { ActivityExpenseEditor } from "./expense-editor";
import { splitState } from "@/lib/pilot/next-action";
const inputClass = "mt-1 block w-full rounded-lg border border-app-border p-3";
export default function ActivityWorkspace() {
  const search = useSearchParams();
  const [ready, setReady] = useState(false),
    [guest, setGuest] = useState(true),
    [email, setEmail] = useState(samplePeople[0].email),
    [rows, setRows] = useState<RecordRow[]>([]),
    [selected, setSelected] = useState(search.get("activity") ?? ""),
    [group, setGroup] = useState(""),
    [list, setList] = useState(false),
    [archive, setArchive] = useState(false),
    [query, setQuery] = useState(""),
    [menu, setMenu] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true);
  const [modal, setModal] = useState<
      "new" | "groups" | "expense" | "schedule" | "signin" | "share" | null
    >(null),
    [editing, setEditing] = useState<Split>(),
    [preset, setPreset] = useState<Expense>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [pending, setPending] = useState<Operation>();
  const [repeatSource, setRepeatSource] = useState<Activity>();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = composerRef.current;
    if (node) {
      node.style.height = "auto";
      node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
    }
  }, [text]);
  const guard = useRef(false);
  const entryActivity = useRef(search.get("activity"));
  const entryGroup = useRef(search.get("group"));
  const activities = rows
      .filter(
        (r): r is Extract<RecordRow, { kind: "activity" }> =>
          r.kind === "activity",
      )
      .map((r) => r.document),
    groups = rows
      .filter(
        (r): r is Extract<RecordRow, { kind: "group" }> => r.kind === "group",
      )
      .map((r) => r.document);
  const activity = activities.find((a) => a.id === selected),
    chosenGroup = groups.find((g) => g.id === group);
  const refresh = useCallback(async () => {
    if (!guest) {
      const session = await getSession();
      if (!session) {
        setRows([]);
        setModal("signin");
        return;
      }
      if (session.email !== email) {
        setRows([]);
        setEmail(session.email);
        return;
      }
    }
    try {
      setRows(await loadWorkspace(guest, email));
    } catch (e) {
      if (!guest && !(await getSession())) {
        setRows([]);
        setModal("signin");
      }
      throw e;
    }
  }, [guest, email]);
  useEffect(() => {
    void getSession()
      .then((session) => {
        if (session) {
          setGuest(false);
          setEmail(session.email);
          if (entryGroup.current) {
            setGroup(entryGroup.current);
            setModal("groups");
          }
        } else if (entryGroup.current) setModal("signin");
        if (!session && entryActivity.current)
          void loadWorkspace(true, samplePeople[0].email).then((records) => {
            if (!records.some((r) => r.document.id === entryActivity.current))
              setModal("signin");
          });
        setReady(true);
      })
      .catch((e) => {
        setError(e.message);
        setReady(true);
      });
  }, []);
  useEffect(() => {
    if (!ready) return;
    void refresh().catch((e) => setError(e.message));
    const focus = () => void refresh().catch(() => {});
    window.addEventListener("focus", focus);
    const timer = setInterval(focus, 15000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [ready, refresh]);
  const pendingKey = `splitflow-workspace-pending:${guest ? "sample" : "real"}:${email}`;
  useEffect(() => {
    try {
      setPending(
        JSON.parse(localStorage.getItem(pendingKey) || "null") ?? undefined,
      );
    } catch {
      setError("Could not restore the interrupted submission.");
    }
  }, [pendingKey]);
  async function submit(operation: Omit<Operation, "key">, retry = false) {
    if (guard.current) throw Error("An operation is already saving.");
    guard.current = true;
    setBusy(true);
    setError("");
    const op =
      retry && pending ? pending : { ...operation, key: crypto.randomUUID() };
    try {
      setPending(op);
      localStorage.setItem(pendingKey, JSON.stringify(op));
      const saved = await writeWorkspace(guest, email, op);
      localStorage.removeItem(pendingKey);
      setPending(undefined);
      await refresh();
      return saved;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save. Retry this submission.",
      );
      throw e;
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function command(command: unknown) {
    if (!activity) throw Error("Choose an activity.");
    return submit({
      kind: "activity",
      id: activity.id,
      expected: activity.revision,
      command,
    });
  }
  function openExpense(split?: Split, repeat = false) {
    setEditing(repeat ? undefined : split);
    setPreset(
      repeat && split
        ? {
            ...structuredClone(split.expense),
            title: "",
            participants: split.expense.participants.map((p) => ({
              ...p,
              paid: 0,
            })),
            items: split.expense.items.map((i) => ({
              ...i,
              amount: 0,
              custom: i.custom
                ? Object.fromEntries(
                    Object.keys(i.custom).map((email) => [email, 0]),
                  )
                : undefined,
            })),
          }
        : undefined,
    );
    setModal("expense");
  }
  function select(id: string) {
    setSelected(id);
    setList(false);
    setMenu(false);
    setError("");
    window.history.replaceState(null, "", id ? `/?activity=${id}` : "/");
  }
  const visible = activities.filter(
    (a) =>
      (!group || a.groupId === group) &&
      a.archivedBy.includes(email) === archive &&
      a.title.toLowerCase().includes(query.toLowerCase()),
  );
  function nav() {
    return (
      <>
        <button
          onClick={() => {
            select("");
            setModal(null);
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
          className="sf-nav-row"
        >
          <SquarePen size={18} />
          New conversation
        </button>
        <button
          onClick={() => {
            setList(true);
            setMenu(false);
          }}
          className="sf-nav-row"
        >
          <Search size={18} />
          Your splits
        </button>
        {groups.length > 0 && (
          <>
            <p className="sf-nav-label">Groups</p>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setGroup(g.id);
                  setModal("groups");
                  setMenu(false);
                  setList(false);
                }}
                className="sf-nav-row"
              >
                {g.name}
              </button>
            ))}
          </>
        )}
        <p className="sf-nav-label">Recent conversations</p>
        {activities
          .filter((a) => !a.archivedBy.includes(email))
          .slice()
          .reverse()
          .map((a) => (
            <button
              key={a.id}
              onClick={() => select(a.id)}
              className={`sf-nav-row truncate ${selected === a.id ? "sf-nav-selected" : ""}`}
            >
              {a.title}
            </button>
          ))}
        <div className="sf-account">
          <span className="sf-avatar" aria-hidden="true">
            {(guest ? samplePeople.find((p) => p.email === email)?.name : email)
              ?.slice(0, 1)
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {guest ? (
              <label className="block">
                <span className="sr-only">Sample person</span>
                <select
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sf-account-select"
                >
                  {samplePeople.map((p) => (
                    <option key={p.email} value={p.email}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="truncate text-sm">{email}</p>
            )}
            <p className="text-xs text-app-muted">
              {guest ? "Guest sample workspace" : "Personal account"}
            </p>
          </div>
          <details className="relative">
            <summary aria-label="Account options" className="sf-icon-button">
              <MoreHorizontal size={18} />
            </summary>
            <div className="sf-popup absolute bottom-full right-0 mb-2 w-52">
              {guest ? (
                <>
                  <button onClick={() => setModal("signin")}>
                    Sign in for real activities
                  </button>
                  <button
                    onClick={() => {
                      resetSample();
                      select("");
                      void refresh();
                    }}
                  >
                    Reset sample records
                  </button>
                </>
              ) : (
                <>
                  <a href="/?legacy=1">Previous saved records</a>
                  <button
                    onClick={() => {
                      clearSession();
                      setGuest(true);
                      setEmail(samplePeople[0].email);
                      select("");
                    }}
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </details>
        </div>
      </>
    );
  }
  const inlineFlow = Boolean(modal && modal !== "signin");
  const modalTitle =
    modal === "new"
      ? "New activity"
      : modal === "groups"
        ? "Shared groups"
        : modal === "expense"
          ? "Review expense"
          : modal === "schedule"
            ? "Recurring schedule"
            : modal === "share"
              ? "People & share"
              : "Sign in";
  function closeWorkflow() {
    if (!busy) setModal(null);
  }
  function workflowContent() {
    return (
      <>
        {modal === "signin" && (
          <ActivitySignIn
            onSignedIn={(value) => {
              setGuest(false);
              setEmail(value);
              setModal(entryGroup.current ? "groups" : null);
              setRows([]);
              void loadWorkspace(false, value)
                .then(setRows)
                .catch((e) => setError(e.message));
            }}
          />
        )}
        {modal === "new" && (
          <NewActivityForm
            email={email}
            groups={groups}
            group={
              repeatSource
                ? groups.find((g) => g.id === repeatSource.groupId)
                : chosenGroup
            }
            seed={repeatSource}
            suggestedTitle={!activity ? text.slice(0, 120) : undefined}
            busy={busy}
            onSave={async (input) => {
              const value = await submit({
                id: crypto.randomUUID(),
                expected: 0,
                kind: "activity",
                input,
              });
              setModal(null);
              setRepeatSource(undefined);
              select(value!.id);
              if (!activity && text.trim()) {
                await submit({
                  kind: "activity",
                  id: value!.id,
                  expected: value!.revision,
                  command: { type: "message", text: text.trim() },
                });
                setText("");
              }
            }}
          />
        )}
        {modal === "groups" && (
          <GroupsPanel
            groups={groups}
            initialGroupId={group || activity?.groupId}
            activities={activities}
            email={email}
            busy={busy}
            onOpenActivity={(id) => {
              select(id);
              setModal(null);
            }}
            onStart={(id) => {
              setGroup(id);
              setRepeatSource(undefined);
              sessionStorage.setItem("splitflow-new-kind", "quick");
              setModal("new");
            }}
            onSelect={(id) => {
              setGroup(id);
              setList(true);
              setModal(null);
            }}
            onSave={async (name, people) => {
              const created = await submit({
                kind: "group",
                id: crypto.randomUUID(),
                expected: 0,
                input: { name, people },
              });
              return created!.id;
            }}
            onCommand={async (g, cmd) => {
              await submit({
                kind: "group",
                id: g.id,
                expected: g.revision,
                command: cmd,
              });
            }}
          />
        )}
        {modal === "expense" && activity && (
          <ActivityExpenseEditor
            guest={guest}
            activityId={activity.id}
            slot={editing?.id ?? "new"}
            email={email}
            busy={busy}
            original={editing?.expense}
            initial={
              preset ?? {
                title: activity.expenses.length ? "" : activity.title,
                mode: activity.kind === "planned" ? "planned" : "paid",
                participants: activity.people.map((p) => ({ ...p, paid: 0 })),
                items: [
                  {
                    name: "Cost",
                    amount: 0,
                    included: activity.people.map((p) => p.email),
                  },
                ],
              }
            }
            onSave={async (expense, reason) => {
              await command(
                editing
                  ? {
                      type: "expenseCommand",
                      id: editing.id,
                      expected: editing.revision,
                      command: { type: "revise", expense, reason },
                    }
                  : { type: "expense", id: crypto.randomUUID(), expense },
              );
              setModal(null);
            }}
          />
        )}
        {modal === "schedule" && activity && (
          <ScheduleForm
            activity={activity}
            email={email}
            busy={busy}
            onSave={async (value) => {
              await command(value);
              setModal(null);
            }}
          />
        )}
        {modal === "share" && activity && <ActivityShare activity={activity} />}
      </>
    );
  }
  function renderComposer() {
    return (
      <div className="sf-composer-dock">
        <form
          className="sf-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!activity) {
              setModal("new");
              return;
            }
            const value = text;
            void command({ type: "message", text: value })
              .then(() => setText(""))
              .catch(() => {});
          }}
        >
          <label className="sr-only" htmlFor="activity-message">
            Message your activity
          </label>
          <div className="flex items-end gap-1">
            <details
              className="static"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button"))
                  e.currentTarget.removeAttribute("open");
              }}
            >
              <summary
                aria-label="More activity actions"
                className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full hover:bg-slate-100"
              >
                <Plus size={19} />
              </summary>
              <div className="sf-popup absolute bottom-full left-0 z-20 mb-2 w-64 max-w-full">
                {activity && (
                  <button
                    type="button"
                    disabled={busy || Boolean(pending)}
                    onClick={() => openExpense()}
                  >
                    <Receipt size={17} />
                    Add cost
                  </button>
                )}
                {!activity &&
                  (["quick", "planned", "recurring"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setModal("new");
                        sessionStorage.setItem("splitflow-new-kind", kind);
                      }}
                    >
                      {kind === "quick"
                        ? "Split a cost"
                        : kind === "planned"
                          ? "Plan an activity"
                          : "Set up recurring costs"}
                    </button>
                  ))}
                {Boolean(activity?.templates?.length) && (
                  <select
                    aria-label="Reuse expense rules"
                    value=""
                    onChange={(e) => {
                      const template =
                        activity!.templates![Number(e.target.value)];
                      setEditing(undefined);
                      setPreset({
                        ...structuredClone(template),
                        title: template.title,
                        participants: template.participants.map((p) => ({
                          ...p,
                          paid: 0,
                        })),
                        items: template.items.map((i) => ({
                          ...i,
                          amount: 0,
                          custom: i.custom
                            ? Object.fromEntries(
                                Object.keys(i.custom).map((email) => [
                                  email,
                                  0,
                                ]),
                              )
                            : undefined,
                        })),
                      });
                      setModal("expense");
                    }}
                    className="min-h-11 max-w-full rounded-lg bg-slate-50 px-2 text-sm"
                  >
                    <option value="" disabled>
                      Reuse expense rules
                    </option>
                    {activity!.templates!.map((t, i) => (
                      <option key={i} value={i}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setModal(activity ? "share" : "groups")}
                  className="min-h-11 px-3 text-sm"
                >
                  People & share
                </button>
                {activity?.kind === "recurring" &&
                  activity.owner === email &&
                  !activity.schedule && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setModal("schedule")}
                      className="min-h-11 px-3 text-sm"
                    >
                      Schedule
                    </button>
                  )}
                {activity && activity.expenses.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openExpense(activity.expenses.at(-1), true)}
                    className="min-h-11 px-3 text-sm"
                  >
                    Repeat cost
                  </button>
                )}{" "}
              </div>
            </details>
            <textarea
              ref={composerRef}
              disabled={Boolean(selected && !activity)}
              maxLength={4000}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  if (text.trim() && !busy && !pending)
                    e.currentTarget.form?.requestSubmit();
                }
              }}
              id="activity-message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder={activity ? "Message activity…" : "Describe a cost…"}
              className="sf-composer-input"
            />
            <button
              aria-label={activity ? "Send message" : "Start conversation"}
              disabled={busy || !text.trim() || Boolean(pending)}
              className="sf-send"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </form>
        <p className={`sf-composer-note ${activity ? "" : "sr-only"}`}>
          {activity
            ? "Messages go to this activity. Financial changes need your review."
            : "Start with an activity name. Add people and costs in the conversation."}
        </p>
      </div>
    );
  }
  if (!ready)
    return (
      <p role="status" className="p-8">
        Loading SplitFlow…
      </p>
    );
  return (
    <div
      className="sf-workspace flex h-dvh bg-white text-app-text"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          const details = (e.target as HTMLElement).closest("details[open]");
          if (details) {
            details.removeAttribute("open");
            (details.querySelector("summary") as HTMLElement)?.focus();
            e.stopPropagation();
          }
        }
      }}
    >
      <aside className={`sf-sidebar ${sidebarOpen ? "lg:flex" : ""}`}>
        <div className="sf-sidebar-top">
          <a href="/" aria-label="SplitFlow home" className="sf-icon-button">
            <Receipt size={23} />
          </a>
          <button
            aria-label="Collapse sidebar"
            onClick={() => setSidebarOpen(false)}
            className="sf-icon-button"
          >
            <PanelLeft size={19} />
          </button>
        </div>
        {nav()}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sf-header">
          <button
            aria-label="Open navigation"
            onClick={() => {
              if (window.innerWidth >= 1024) setSidebarOpen(true);
              else setMenu(true);
            }}
            className={`sf-icon-button ${sidebarOpen ? "lg:hidden" : ""}`}
          >
            <Menu size={20} />
          </button>
          <button
            className="sf-brand"
            onClick={() => {
              setList(false);
              setModal("groups");
            }}
            aria-label="Workspace groups"
          >
            SplitFlow <ChevronDown size={16} />
          </button>
          <div className="flex-1" />
          {guest && <span className="sf-sample-badge">Sample</span>}
          <button
            onClick={() => {
              setList(false);
              setModal("groups");
            }}
            aria-label="Groups"
            className="sf-icon-button"
          >
            <Users size={16} />
          </button>
          {activity && (
            <button
              className="sf-header-share"
              aria-label="Share activity"
              onClick={() => setModal("share")}
            >
              <Share2 size={17} />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          {activity && (
            <details
              className="relative"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button"))
                  e.currentTarget.removeAttribute("open");
              }}
            >
              <summary
                aria-label="Conversation options"
                className="sf-icon-button"
              >
                <MoreHorizontal size={20} />
              </summary>
              <div className="sf-popup absolute right-0 top-full w-48">
                {" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRepeatSource(activity);
                    setModal("new");
                  }}
                  className="min-h-11 text-xs underline"
                >
                  Repeat activity
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void command({
                      type: "archive",
                      archived: !activity.archivedBy.includes(email),
                    }).catch(() => {})
                  }
                  className="min-h-11 text-xs underline"
                >
                  {activity.archivedBy.includes(email) ? "Restore" : "Archive"}
                </button>
              </div>
            </details>
          )}
          {guest && (
            <button onClick={() => setModal("signin")} className="sf-signin">
              Sign in
            </button>
          )}
        </header>
        <main className="sf-main min-h-0 flex-1 overflow-y-auto">
          <div
            className={`sf-thread ${!activity && !inlineFlow && !list ? "sf-thread-home" : ""}`}
          >
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {pending && (
              <div className="rounded-lg border border-amber-200 p-3 text-sm">
                <p>A submission has not been acknowledged.</p>
                <button
                  disabled={busy}
                  onClick={() => void submit(pending, true).catch(() => {})}
                  className="min-h-11 underline"
                >
                  Retry original submission
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    void refresh().then(() => {
                      setPending(undefined);
                      localStorage.removeItem(pendingKey);
                      setError(
                        "Latest version loaded. Review the current activity before submitting a new change.",
                      );
                    });
                  }}
                  className="ml-4 min-h-11 underline"
                >
                  Review latest version
                </button>
              </div>
            )}
            {list && !inlineFlow ? (
              <>
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-semibold">
                    {chosenGroup?.name ?? "Your splits"}
                  </h1>
                  <label className="text-sm">
                    <input
                      type="checkbox"
                      checked={archive}
                      onChange={(e) => setArchive(e.target.checked)}
                    />{" "}
                    Archived
                  </label>
                </div>
                <input
                  aria-label="Search activities"
                  placeholder="Search activities"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={inputClass}
                />
                <section aria-label="Needs attention" className="space-y-2">
                  {visible
                    .filter((a) =>
                      a.expenses.some(
                        (s) => splitState(s, email).stage === "needs_action",
                      ),
                    )
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => select(a.id)}
                        className="block min-h-11 w-full rounded-lg bg-amber-50 p-3 text-left text-sm"
                      >
                        {a.title} · Needs your attention
                      </button>
                    ))}
                </section>
                {visible.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => select(a.id)}
                    className="block w-full rounded-xl border p-4 text-left"
                  >
                    <strong>{a.title}</strong>
                    <p className="mt-1 text-sm text-app-muted">
                      {a.expenses.length} expenses · {a.kind}
                    </p>
                  </button>
                ))}
                {!visible.length && (
                  <p className="text-sm text-app-muted">
                    No activities in this view.
                  </p>
                )}
              </>
            ) : !activity ? (
              !inlineFlow && (
                <section className="sf-home">
                  <h1>What are we sharing costs for?</h1>
                  {renderComposer()}
                </section>
              )
            ) : (
              <>
                <section
                  className="sf-activity-summary"
                  aria-label="Activity summary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="text-lg font-semibold">
                        {activity.title}
                      </h1>
                      <p className="mt-1 text-xs text-app-muted">
                        {activity.kind} · {activity.people.length} people
                        {activity.groupId
                          ? ` · ${groups.find((g) => g.id === activity.groupId)?.name ?? "Shared group"}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <details className="mt-2 text-sm">
                    <summary className="min-h-11 cursor-pointer py-3">
                      Balances and people
                    </summary>
                    {activity.people.map((p) => {
                      const amount = activity.expenses
                        .filter((s) => s.expense.mode === "paid")
                        .reduce((n, s) => n + (balances(s)[p.email] ?? 0), 0);
                      return (
                        <p key={p.email} className="flex justify-between py-1">
                          <span>{p.name}</span>
                          <span>
                            {amount > 0
                              ? "Owes "
                              : amount < 0
                                ? "Is owed "
                                : ""}
                            {money(Math.abs(amount))}
                          </span>
                        </p>
                      );
                    })}
                    <div className="mt-3 border-t pt-3">
                      <p>
                        Paid toward costs:{" "}
                        {money(
                          activity.expenses
                            .filter((s) => s.expense.mode === "paid")
                            .reduce(
                              (sum, s) =>
                                sum +
                                (s.expense.participants.find(
                                  (p) => p.email === email,
                                )?.paid ?? 0),
                              0,
                            ),
                        )}
                      </p>
                      <p>
                        Confirmed transfers received:{" "}
                        {money(
                          activity.expenses.reduce(
                            (sum, s) =>
                              sum +
                              s.repayments
                                .filter(
                                  (p) =>
                                    p.status === "confirmed" && p.to === email,
                                )
                                .reduce((n, p) => n + p.amount, 0),
                            0,
                          ),
                        )}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-app-muted">
                      Confirmed receipts only. Planned costs are shown
                      separately on their cards.
                    </p>
                  </details>
                </section>
                {!activity.expenses.length &&
                  !activity.schedule &&
                  (activity.kind !== "recurring" ||
                    activity.owner === email) && (
                    <section aria-label="Next step" className="py-4 text-sm">
                      <h2 className="font-medium">
                        {activity.kind === "recurring"
                          ? "Set the recurring terms"
                          : "Add the first cost"}
                      </h2>
                      <p className="mt-2 text-app-muted">
                        {activity.kind === "recurring"
                          ? "Choose the amount and monthly dates. Each person reviews their share before it starts."
                          : "Your people are ready. Enter the amount, review the shares, then publish here."}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          activity.kind === "recurring"
                            ? setModal("schedule")
                            : openExpense()
                        }
                        className="mt-3 min-h-11 rounded-lg bg-slate-900 px-4 text-white"
                      >
                        {activity.kind === "recurring"
                          ? "Set up schedule"
                          : "Add first cost"}
                      </button>
                    </section>
                  )}
                {activity.schedule && (
                  <RecurringTerms
                    key={activity.id}
                    activity={activity}
                    email={email}
                    busy={busy || Boolean(pending)}
                    onCommand={command}
                    onEdit={
                      activity.owner === email
                        ? () => setModal("schedule")
                        : undefined
                    }
                    onRecordActual={
                      activity.owner === email
                        ? () => {
                            setEditing(undefined);
                            setPreset({
                              ...structuredClone(activity.schedule!.expense),
                              mode: "paid",
                            });
                            setModal("expense");
                          }
                        : undefined
                    }
                  />
                )}
                <section aria-label="Conversation" className="space-y-6">
                  <div aria-label="Activity expenses" className="space-y-6">
                    {[
                      ...activity.messages.map((m) => ({
                        kind: "message" as const,
                        at: m.at,
                        id: m.id,
                        message: m,
                      })),
                      ...activity.expenses.map((s) => ({
                        kind: "expense" as const,
                        at: s.audit[0]?.at ?? "",
                        id: s.id,
                        split: s,
                      })),
                    ]
                      .sort((a, b) => a.at.localeCompare(b.at))
                      .map((entry) =>
                        entry.kind === "expense" ? (
                          <ExpenseCard
                            key={entry.id}
                            split={entry.split}
                            email={email}
                            busy={busy || Boolean(pending)}
                            onEdit={() => openExpense(entry.split)}
                            onCommand={async (cmd) => {
                              await command({
                                type: "expenseCommand",
                                id: entry.split.id,
                                expected: entry.split.revision,
                                command: cmd,
                              });
                            }}
                          />
                        ) : (
                          <div
                            key={entry.id}
                            className={
                              entry.message.actor === email
                                ? "sf-message-own"
                                : "sf-message-other"
                            }
                          >
                            <p
                              className={
                                entry.message.actor === email
                                  ? "sr-only"
                                  : "mb-2 text-xs text-app-muted"
                              }
                            >
                              {activity.people.find(
                                (p) => p.email === entry.message.actor,
                              )?.name ?? entry.message.actor}
                            </p>
                            <p className="whitespace-pre-wrap break-words leading-6">
                              {entry.message.text}
                            </p>
                          </div>
                        ),
                      )}
                  </div>
                </section>
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-3">
                    Activity history
                  </summary>
                  {activity.expenses.flatMap((s) =>
                    s.audit.map((event, i) => (
                      <p key={`${s.id}:${i}`} className="border-t py-2">
                        {s.expense.title} · {event.action} ·{" "}
                        {new Date(event.at).toLocaleString()}
                      </p>
                    )),
                  )}
                </details>
              </>
            )}
            {inlineFlow && (
              <ActivityPanel
                key={modal}
                title={modalTitle}
                onClose={closeWorkflow}
              >
                {workflowContent()}
              </ActivityPanel>
            )}
          </div>
        </main>
        {(activity || inlineFlow) && (!list || inlineFlow) && renderComposer()}
      </div>
      {menu && (
        <ActivityDialog title="Navigation" onClose={() => setMenu(false)}>
          <div className="flex flex-col">{nav()}</div>
        </ActivityDialog>
      )}
      {modal && !inlineFlow && (
        <ActivityDialog title={modalTitle} onClose={closeWorkflow}>
          {workflowContent()}
        </ActivityDialog>
      )}
    </div>
  );
}
function GroupsPanel({
  groups,
  initialGroupId,
  activities,
  email,
  busy,
  onSelect,
  onOpenActivity,
  onStart,
  onSave,
  onCommand,
}: {
  groups: SharedGroup[];
  initialGroupId?: string;
  activities: Activity[];
  email: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onOpenActivity: (id: string) => void;
  onStart: (id: string) => void;
  onSave: (name: string, people: Person[]) => Promise<string>;
  onCommand: (g: SharedGroup, cmd: unknown) => Promise<void>;
}) {
  const [focused, setFocused] = useState(initialGroupId ?? "");
  const [view, setView] = useState<"activities" | "people">("activities");
  const [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <div className="sf-flow space-y-4">
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {focused && (
        <button
          type="button"
          onClick={() => setFocused("")}
          className="min-h-11 text-sm underline"
        >
          All groups
        </button>
      )}
      {!focused && (
        <button
          onClick={() => onSelect("")}
          className="min-h-11 text-sm underline"
        >
          All activities
        </button>
      )}
      {!focused && !creating && (
        <div className="divide-y">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setFocused(g.id)}
              className="flex min-h-16 w-full items-center justify-between gap-3 py-4 text-left"
            >
              <span>
                <strong className="block font-medium">{g.name}</strong>
                <span className="text-xs text-app-muted">
                  {g.joined.length} joined · {g.people.length - g.joined.length}{" "}
                  invited
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}
      {groups
        .filter((g) => g.id === focused && !creating)
        .map((g) => (
          <div key={g.id} className="space-y-4">
            <h3 className="font-semibold">{g.name}</h3>
            <p className="mt-1 text-xs text-app-muted">
              {g.joined.length} joined · {g.people.length - g.joined.length}{" "}
              invited · {activities.filter((a) => a.groupId === g.id).length}{" "}
              activities visible to you
            </p>
            <div
              className="flex gap-2 border-b"
              role="tablist"
              aria-label="Group details"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "activities"}
                onClick={() => setView("activities")}
                className={`min-h-11 px-3 ${view === "activities" ? "border-b-2 border-slate-900 font-medium" : "text-app-muted"}`}
              >
                Activities
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "people"}
                onClick={() => setView("people")}
                className={`min-h-11 px-3 ${view === "people" ? "border-b-2 border-slate-900 font-medium" : "text-app-muted"}`}
              >
                People & invitations
              </button>
            </div>
            {view === "activities" &&
              (g.joined.includes(email) ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => onStart(g.id)}
                    className="min-h-11 rounded-lg bg-slate-900 px-3 text-sm text-white"
                  >
                    Start activity in {g.name}
                  </button>
                  {activities
                    .filter(
                      (a) =>
                        a.groupId === g.id && !a.archivedBy.includes(email),
                    )
                    .slice()
                    .reverse()
                    .map((a) => {
                      const balance = a.expenses
                        .filter((s) => s.expense.mode === "paid")
                        .reduce((sum, s) => sum + (balances(s)[email] ?? 0), 0);
                      return (
                        <button
                          key={a.id}
                          onClick={() => onOpenActivity(a.id)}
                          className="sf-group-activity"
                        >
                          <span className="min-w-0 break-words">{a.title}</span>
                          <span className="shrink-0 text-xs text-app-muted">
                            {balance > 0
                              ? `You owe ${money(balance)}`
                              : balance < 0
                                ? `Owed to you ${money(-balance)}`
                                : !a.expenses.some(
                                      (s) => s.expense.mode === "paid",
                                    )
                                  ? a.schedule
                                    ? "Recurring terms"
                                    : a.expenses.length
                                      ? "Planned costs"
                                      : "No costs yet"
                                  : "No outstanding balance"}
                          </span>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    void onCommand(g, { type: "join" }).catch((e) =>
                      setError(e.message),
                    )
                  }
                  className="min-h-11 text-sm underline"
                >
                  Accept group invitation
                </button>
              ))}
            {view === "people" && (
              <div className="text-sm">
                {" "}
                <label className="mt-4 block text-xs text-app-muted">
                  Group invitation link
                  <input
                    readOnly
                    value={`${location.origin}/?group=${g.id}`}
                    onFocus={(e) => e.target.select()}
                    className="mt-2 w-full rounded-lg border border-app-border p-3 text-sm"
                  />
                </label>
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(`${location.origin}/?group=${g.id}`)
                      .then(() =>
                        setNotice(
                          "Group link copied. Only invited accounts can join.",
                        ),
                      )
                      .catch(() => setError("Unable to copy group link."))
                  }
                  className="sf-primary my-3"
                >
                  Copy group invitation
                </button>
                <p className="mb-4 text-xs text-app-muted">
                  Only invited accounts can join. Forwarding the link does not
                  add members.
                </p>
                {g.people.map((p) => (
                  <div
                    key={p.email}
                    className="flex flex-wrap items-center justify-between gap-2 py-1"
                  >
                    <span>
                      {p.name} ·{" "}
                      {g.joined.includes(p.email) ? "Joined" : "Invited"}
                    </span>
                    {g.owner === email && p.email !== email && (
                      <details className="relative">
                        <summary
                          aria-label={`Options for ${p.name}`}
                          className="sf-icon-button"
                        >
                          <MoreHorizontal size={18} />
                        </summary>
                        <div className="sf-popup absolute right-0 top-full w-48">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void onCommand(g, {
                                type: "remove",
                                email: p.email,
                              }).catch((e) => setError(e.message))
                            }
                            className="min-h-11 underline"
                          >
                            Remove from group
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
                {g.owner === email ? (
                  <details className="sf-disclosure">
                    <summary>Rename group</summary>
                    <form
                      className="mt-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = String(
                          new FormData(e.currentTarget).get("name"),
                        );
                        void onCommand(g, { type: "rename", name }).catch((e) =>
                          setError(e.message),
                        );
                      }}
                    >
                      <label>
                        Group name
                        <input
                          name="name"
                          defaultValue={g.name}
                          required
                          className={inputClass}
                        />
                      </label>
                      <button disabled={busy} className="min-h-11 underline">
                        Save name
                      </button>
                    </form>
                  </details>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void onCommand(g, { type: "leave" }).catch((e) =>
                        setError(e.message),
                      )
                    }
                    className="min-h-11 underline"
                  >
                    Leave group
                  </button>
                )}
                {g.owner === email && (
                  <details className="sf-disclosure">
                    <summary>Invite another person</summary>
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void onCommand(g, {
                          type: "invite",
                          people: [
                            g.people.find((p) => p.email === g.owner),
                            {
                              name: String(data.get("name")),
                              email: String(data.get("email"))
                                .trim()
                                .toLowerCase(),
                            },
                          ],
                        }).catch((e) => setError(e.message));
                      }}
                    >
                      <label className="block">
                        Invite name
                        <input name="name" required className={inputClass} />
                      </label>
                      <label className="block">
                        Invite email
                        <input
                          name="email"
                          type="email"
                          required
                          className={inputClass}
                        />
                      </label>
                      <button disabled={busy} className="min-h-11 underline">
                        Invite or renew invitation
                      </button>
                      <p className="text-xs text-app-muted">
                        Invitations expire after seven days. Removing someone
                        preserves their existing activity records.
                      </p>
                    </form>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}
      {!focused && (
        <button
          onClick={() => setCreating(!creating)}
          className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm"
        >
          {creating ? "Back to groups" : "Create group"}
        </button>
      )}
      {creating && (
        <GroupEditor
          email={email}
          shared
          busy={busy}
          onCancel={() => setCreating(false)}
          onSave={async (value) => {
            try {
              const id = await onSave(value.name, value.people);
              setFocused(id);
              setView("people");
              setCreating(false);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to save group.",
              );
            }
          }}
        />
      )}
    </div>
  );
}
