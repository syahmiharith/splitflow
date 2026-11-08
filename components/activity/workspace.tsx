"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Menu, Users, ArrowUp, ChevronDown } from "lucide-react";
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
import { ExpenseForm } from "@/components/pilot-expense-form";
import { GroupEditor } from "@/components/group-editor";
import { ActivityDialog } from "./dialog";
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
    [menu, setMenu] = useState(false);
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
            setModal("new");
          }}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-slate-200"
        >
          <Plus size={16} />
          New conversation
        </button>
        <button
          onClick={() => {
            setList(true);
            setMenu(false);
          }}
          className="min-h-11 rounded-lg px-3 text-left text-sm hover:bg-slate-200"
        >
          Your splits
        </button>
        <p className="px-3 pb-2 pt-7 text-xs text-app-muted">Activities</p>
        {visible.map((a) => (
          <button
            key={a.id}
            onClick={() => select(a.id)}
            className={`min-h-11 truncate rounded-lg px-3 text-left text-sm ${selected === a.id ? "bg-slate-200" : "hover:bg-slate-100"}`}
          >
            {a.title}
          </button>
        ))}
        <div className="mt-auto space-y-2 pt-6">
          {guest ? (
            <>
              <p className="px-3 text-xs font-medium">Guest sample workspace</p>
              <label className="block px-3 text-xs">
                Sample person
                <select
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  className="mt-2 w-full rounded border bg-white p-2"
                >
                  {samplePeople.map((p) => (
                    <option key={p.email} value={p.email}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => setModal("signin")}
                className="min-h-11 px-3 text-sm underline"
              >
                Sign in for real activities
              </button>
              <button
                onClick={() => {
                  resetSample();
                  select("");
                  void refresh();
                }}
                className="min-h-11 px-3 text-xs text-app-muted"
              >
                Reset sample records
              </button>
            </>
          ) : (
            <>
              <p className="truncate px-3 text-xs">{email}</p>
              <a
                href="/?legacy=1"
                className="block min-h-11 px-3 py-3 text-xs underline"
              >
                Previous saved records
              </a>
              <button
                onClick={() => {
                  clearSession();
                  setGuest(true);
                  setEmail(samplePeople[0].email);
                  select("");
                }}
                className="min-h-11 px-3 text-sm"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </>
    );
  }
  if (!ready)
    return (
      <p role="status" className="p-8">
        Loading SplitFlow…
      </p>
    );
  return (
    <div className="flex h-dvh bg-white text-app-text">
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-50 p-3 lg:flex">
        <a href="/" className="px-3 py-5 text-xl font-semibold">
          SplitFlow
        </a>
        {nav()}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-3 border-b border-slate-100 px-4">
          <button
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
            className="h-11 w-11 lg:hidden"
          >
            <Menu size={20} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            SplitFlow
          </span>
          {guest && (
            <span className="shrink-0 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Sample
            </span>
          )}
          <button
            onClick={() => setModal("groups")}
            className="flex min-h-11 items-center gap-2 px-2 text-sm"
          >
            <Users size={16} />
            Groups
            <ChevronDown size={14} />
          </button>
          {guest && (
            <button
              onClick={() => setModal("signin")}
              className="min-h-11 px-2 text-sm"
            >
              Sign in
            </button>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-8">
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
            {list ? (
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
              <section className="py-12 md:py-20">
                <h1 className="text-3xl font-semibold tracking-tight">
                  What are we sharing costs for?
                </h1>
                <p className="mt-3 text-sm leading-6 text-app-muted">
                  Rent, a trip, dinner or something else. Keep the costs and
                  decisions together in one conversation.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(["quick", "planned", "recurring"] as const).map((kind) => (
                    <button
                      key={kind}
                      onClick={() => {
                        setModal("new");
                        sessionStorage.setItem("splitflow-new-kind", kind);
                      }}
                      className="min-h-11 rounded-lg border px-4 text-sm"
                    >
                      {kind === "quick"
                        ? "Split a cost"
                        : kind === "planned"
                          ? "Plan an activity"
                          : "Set up recurring costs"}
                    </button>
                  ))}
                </div>
                <div className="mt-8 space-y-2">
                  {visible.slice(0, 3).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => select(a.id)}
                      className="block min-h-11 text-sm underline"
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <>
                <section
                  className="border-b border-slate-100 pb-3"
                  aria-label="Activity summary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold">
                        {activity.title}
                      </h1>
                      <p className="mt-1 text-xs text-app-muted">
                        {activity.kind} · {activity.people.length} people
                        {activity.groupId
                          ? ` · ${groups.find((g) => g.id === activity.groupId)?.name ?? "Shared group"}`
                          : ""}
                      </p>
                    </div>
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
                      {activity.archivedBy.includes(email)
                        ? "Restore"
                        : "Archive"}
                    </button>
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
                {activity.schedule && (
                  <RecurringTerms
                    key={activity.id}
                    activity={activity}
                    email={email}
                    busy={busy || Boolean(pending)}
                    onCommand={command}
                  />
                )}
                <div className="space-y-4" aria-label="Activity expenses">
                  {activity.expenses.map((s) => (
                    <ExpenseCard
                      key={s.id}
                      split={s}
                      email={email}
                      busy={busy || Boolean(pending)}
                      onEdit={() => openExpense(s)}
                      onCommand={async (cmd) => {
                        await command({
                          type: "expenseCommand",
                          id: s.id,
                          expected: s.revision,
                          command: cmd,
                        });
                      }}
                    />
                  ))}
                </div>
                <section aria-label="Conversation" className="space-y-4">
                  {activity.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${m.actor === email ? "ml-auto bg-slate-100" : "bg-slate-50"}`}
                    >
                      <p className="mb-1 text-xs text-app-muted">
                        {activity.people.find((p) => p.email === m.actor)
                          ?.name ?? m.actor}
                      </p>
                      <p className="whitespace-pre-wrap break-words">
                        {m.text}
                      </p>
                    </div>
                  ))}
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
          </div>
        </main>
        {activity && !list && (
          <div className="bg-white px-4 pb-3 pt-2">
            <form
              className="mx-auto max-w-3xl rounded-2xl border border-app-border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = text;
                void command({ type: "message", text: value })
                  .then(() => setText(""))
                  .catch(() => {});
              }}
            >
              <label className="sr-only" htmlFor="activity-message">
                Message your activity
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id="activity-message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={1}
                  placeholder="Discuss this activity…"
                  className="min-h-11 min-w-0 flex-1 resize-y rounded-lg p-3 text-sm outline-none focus-visible:ring-2"
                />
                <button
                  aria-label="Send message"
                  disabled={busy || !text.trim() || Boolean(pending)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-white disabled:opacity-40"
                >
                  <ArrowUp size={18} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {Boolean(activity.templates?.length) && (
                  <select
                    aria-label="Reuse expense rules"
                    value=""
                    onChange={(e) => {
                      const template =
                        activity.templates![Number(e.target.value)];
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
                    {activity.templates!.map((t, i) => (
                      <option key={i} value={i}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={busy || Boolean(pending)}
                  onClick={() => openExpense()}
                  className="min-h-11 rounded-lg px-3 text-sm hover:bg-slate-100"
                >
                  Add cost
                </button>
                <button
                  type="button"
                  onClick={() => setModal("share")}
                  className="min-h-11 px-3 text-sm"
                >
                  People & share
                </button>
                {activity.kind === "recurring" && activity.owner === email && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setModal("schedule")}
                    className="min-h-11 px-3 text-sm"
                  >
                    Schedule
                  </button>
                )}
                {activity.expenses.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openExpense(activity.expenses.at(-1), true)}
                    className="min-h-11 px-3 text-sm"
                  >
                    Repeat cost
                  </button>
                )}
              </div>
            </form>
            <p className="mx-auto mt-2 max-w-3xl text-xs text-app-muted">
              Messages are shared with this activity. Use the controls to review
              and publish financial changes.
            </p>
          </div>
        )}
      </div>
      {menu && (
        <ActivityDialog title="Navigation" onClose={() => setMenu(false)}>
          <div className="flex flex-col">{nav()}</div>
        </ActivityDialog>
      )}
      {modal && (
        <ActivityDialog
          title={
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
                      : "Sign in"
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
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
              group={
                repeatSource
                  ? groups.find((g) => g.id === repeatSource.groupId)
                  : chosenGroup
              }
              seed={repeatSource}
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
              }}
            />
          )}
          {modal === "groups" && (
            <GroupsPanel
              groups={groups}
              activities={activities}
              email={email}
              busy={busy}
              onSelect={(id) => {
                setGroup(id);
                setList(true);
                setModal(null);
              }}
              onSave={async (name, people) => {
                await submit({
                  kind: "group",
                  id: crypto.randomUUID(),
                  expected: 0,
                  input: { name, people },
                });
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
          {modal === "share" && activity && (
            <div className="space-y-3 text-sm">
              <p>
                Only the listed accounts can open this activity. Each person
                signs in with their own email.
              </p>
              {activity.people.map((p) => (
                <div
                  key={p.email}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2"
                >
                  <div>
                    <p>{p.name}</p>
                    <p className="text-xs text-app-muted">{p.email}</p>
                  </div>
                  <button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(
                          `${location.origin}/?activity=${activity.id}`,
                        )
                        .then(() => setError("Activity link copied."))
                        .catch(() =>
                          setError(
                            "Unable to copy. Copy the activity URL from your browser.",
                          ),
                        )
                    }
                    className="min-h-11 underline"
                  >
                    Copy link
                  </button>
                </div>
              ))}
              <p className="text-xs text-app-muted">
                Group membership alone does not give access to this activity.
              </p>
            </div>
          )}
        </ActivityDialog>
      )}
    </div>
  );
}
function NewActivityForm({
  email,
  group,
  seed,
  busy,
  onSave,
}: {
  email: string;
  group?: SharedGroup;
  seed?: Activity;
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [kind, setKind] = useState(
      seed?.kind ?? sessionStorage.getItem("splitflow-new-kind") ?? "quick",
    ),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        try {
          const people = String(data.get("people"))
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const [name, mail] = line.split(",");
              return {
                name: name.trim(),
                email: (mail ?? "").trim().toLowerCase(),
              };
            });
          void onSave({
            title: data.get("title"),
            kind,
            people,
            ...(group ? { groupId: group.id } : {}),
            ...(seed ? { templates: seed.expenses.map((s) => s.expense) } : {}),
          }).catch((e) => setError(e.message));
        } catch {
          setError("Enter one name and email per line.");
        }
      }}
    >
      <label className="block">
        Activity name
        <input
          name="title"
          required
          defaultValue={seed ? `${seed.title} again` : ""}
          maxLength={120}
          className={inputClass}
        />
      </label>
      <label className="block">
        Workflow
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={inputClass}
        >
          <option value="quick">Quick shared costs</option>
          <option value="planned">Planned activity</option>
          <option value="recurring">Recurring arrangement</option>
        </select>
      </label>
      <label className="block">
        People — name, email (one per line)
        <textarea
          name="people"
          required
          rows={4}
          defaultValue={
            seed
              ? seed.people.map((p) => `${p.name}, ${p.email}`).join("\n")
              : group
                ? group.people
                    .filter((p) => group.joined.includes(p.email))
                    .map((p) => `${p.name}, ${p.email}`)
                    .join("\n")
                : `You, ${email}\n`
          }
          className={inputClass}
        />
      </label>
      {group && (
        <p>Group: {group.name}. Include only the people participating.</p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 rounded-lg bg-slate-900 px-4 text-white"
      >
        Start activity
      </button>
    </form>
  );
}
function GroupsPanel({
  groups,
  activities,
  email,
  busy,
  onSelect,
  onSave,
  onCommand,
}: {
  groups: SharedGroup[];
  activities: Activity[];
  email: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onSave: (name: string, people: Person[]) => Promise<void>;
  onCommand: (g: SharedGroup, cmd: unknown) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        onClick={() => onSelect("")}
        className="min-h-11 text-sm underline"
      >
        All activities
      </button>
      {groups.map((g) => (
        <div key={g.id} className="rounded-lg border p-4">
          <h3 className="font-semibold">{g.name}</h3>
          <p className="mt-1 text-xs text-app-muted">
            {g.joined.length} joined · {g.people.length - g.joined.length}{" "}
            invited · {activities.filter((a) => a.groupId === g.id).length}{" "}
            activities visible to you
          </p>
          {g.joined.includes(email) ? (
            <button
              onClick={() => onSelect(g.id)}
              className="min-h-11 text-sm underline"
            >
              Open group activities
            </button>
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
          )}
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3">
              Members & settings
            </summary>
            {g.people.map((p) => (
              <div
                key={p.email}
                className="flex flex-wrap items-center justify-between gap-2 py-1"
              >
                <span>
                  {p.name} · {g.joined.includes(p.email) ? "Joined" : "Invited"}
                </span>
                {g.owner === email && p.email !== email && (
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
                )}
              </div>
            ))}
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(`${location.origin}/?group=${g.id}`)
                  .then(() =>
                    setError(
                      "Group link copied. Only invited accounts can join.",
                    ),
                  )
                  .catch(() => setError("Unable to copy group link."))
              }
              className="min-h-11 underline"
            >
              Copy group invitation
            </button>
            {g.owner === email ? (
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
                        email: String(data.get("email")).trim().toLowerCase(),
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
            )}
          </details>
        </div>
      ))}
      <button
        onClick={() => setCreating(!creating)}
        className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm"
      >
        Create group
      </button>
      {creating && (
        <GroupEditor
          email={email}
          busy={busy}
          onCancel={() => setCreating(false)}
          onSave={async (value) => {
            try {
              await onSave(value.name, value.people);
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
function ScheduleForm({
  activity,
  email,
  busy,
  onSave,
}: {
  activity: Activity;
  email: string;
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const expectedVersion = useRef(activity.schedule?.version ?? 0);
  const [start, setStart] = useState(
      activity.schedule?.start ?? new Date().toISOString().slice(0, 10),
    ),
    [dueDay, setDueDay] = useState(activity.schedule?.dueDay ?? 1),
    [variable, setVariable] = useState(activity.schedule?.variable ?? false);
  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        First period starts
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        Due day of month (1–28)
        <input
          type="number"
          min={1}
          max={28}
          value={dueDay}
          onChange={(e) => setDueDay(Number(e.target.value))}
          className={inputClass}
        />
      </label>
      <label className="block">
        <input
          type="checkbox"
          checked={variable}
          onChange={(e) => setVariable(e.target.checked)}
        />{" "}
        Variable bill: wait for each actual amount
      </label>
      <p>
        Everyone included must accept these terms before automatic publication.
        Changed terms require fresh acceptance.
      </p>
      <ExpenseForm
        allowAIDraft={false}
        email={email}
        busy={busy}
        initial={
          activity.schedule?.expense ?? {
            title: activity.title,
            mode: "paid",
            participants: activity.people.map((p) => ({ ...p, paid: 0 })),
            items: [
              {
                name: "Recurring cost",
                amount: 0,
                included: activity.people.map((p) => p.email),
              },
            ],
          }
        }
        onSave={async (expense) =>
          onSave({
            type: "schedule",
            expectedVersion: expectedVersion.current,
            expense,
            start,
            dueDay,
            variable,
          })
        }
      />
    </div>
  );
}
