"use client";
import { Select } from "@/components/controls/select";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileText, WalletCards, Plus } from "lucide-react";
import { SplitHistory } from "@/components/split-history";
import { SplitLibrary } from "@/components/split-library";
import { SplitConversation } from "@/components/split-conversation";
import type { Conversation } from "@/lib/pilot/conversation";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  balances,
  calculateExpense,
  itemShare,
  settlements,
  type Expense,
  type PilotMutation,
  type Split,
} from "@/lib/pilot/model";
import {
  clearSession,
  getSession,
  storeSession,
  pilotRequest,
} from "@/lib/pilot/session";
import {
  readPending,
  storePending,
  clearPending,
} from "@/lib/pilot/pending-operation";
import { nextAction } from "@/lib/pilot/next-action";
import { PilotFeedback } from "@/components/pilot-feedback";
import { ExpenseForm } from "@/components/pilot-expense-form";
const money = (amount: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
export default function SplitWorkspace() {
  const router = useRouter();
  const search = useSearchParams();
  const selected = search.get("split") ?? undefined;
  const view = search.get("view") ?? "home";
  const creating = view === "new" && !selected;
  const conversationId = search.get("conversation") ?? undefined;
  const [newConversationId, setNewConversationId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationError, setConversationError] = useState("");
  const chatting = !selected && !creating && view !== "splits";
  const loadSequence = useRef(0);
  const loadedIdentity = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [splits, setSplits] = useState<Split[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    revision: number;
    expense: Expense;
  }>();
  const [viewedRevisions, setViewedRevisions] = useState<
    Record<string, number>
  >({});
  const [pending, setPending] = useState<{ body: string; key: string }>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  async function load() {
    const sequence = ++loadSequence.current;
    const session = await getSession();
    if (sequence !== loadSequence.current) return;
    if (!session) {
      loadedIdentity.current = undefined;
      setEditing(undefined);
      setPending(undefined);
      setViewedRevisions({});
      setToken("");
      setConversations([]);
      setSplits([]);
      setLoading(false);
      return;
    }
    if (loadedIdentity.current !== session.email) {
      setConversations([]);
      setSplits([]);
      setEditing(undefined);
      setViewedRevisions({});
      loadedIdentity.current = session.email;
      setDraftId("");
    }
    setToken(session.access_token);
    setEmail(session.email);
    setPending(readPending(session.email));
    const rows = await pilotRequest("/api/pilot");
    if (
      sequence !== loadSequence.current ||
      (await getSession())?.email !== session.email
    )
      return;
    setSplits(rows);
    try {
      const chats = await pilotRequest("/api/pilot/conversations");
      const requested = new URLSearchParams(window.location.search).get(
        "conversation",
      );
      if (
        requested &&
        !chats.some((chat: Conversation) => chat.id === requested)
      )
        chats.push(
          ...(await pilotRequest(
            `/api/pilot/conversations?id=${encodeURIComponent(requested)}`,
          )),
        );
      if (
        sequence === loadSequence.current &&
        loadedIdentity.current === session.email
      ) {
        setConversations(chats);
        setConversationError("");
      }
    } catch {
      if (sequence === loadSequence.current)
        setConversationError(
          "Couldn’t load conversations. Refresh to retry. Your splits are still available.",
        );
    }
    setViewedRevisions((previous) =>
      Object.fromEntries(
        rows.map((split: Split) => [
          split.id,
          previous[split.id] ?? split.revision,
        ]),
      ),
    );
    setLoading(false);
  }
  useEffect(() => {
    const refresh = () => {
      void load().catch(async (error) => {
        setSplits([]);
        setLoading(false);
        if (!(await getSession().catch(() => null))) setToken("");
        setMessage(error.message);
      });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    if (!creating || !token || draftId) return;
    const id = crypto.randomUUID();
    setDraftId(id);
    void pilotRequest("/api/pilot/measurements", {
      method: "POST",
      body: JSON.stringify({ type: "started", id }),
    }).catch(() => {});
  }, [creating, Boolean(token), draftId]);
  useEffect(() => {
    if (!creating) setDraftId("");
  }, [creating]);
  useEffect(() => {
    if (!conversationId && email) {
      const storageKey = `splitflow-new-conversation:${email}`;
      const id = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, id);
      setNewConversationId(id);
    }
  }, [conversationId, email]);
  function signOut() {
    setConversations([]);
    loadedIdentity.current = undefined;
    loadSequence.current += 1;
    clearSession();
    setEditing(undefined);
    setPending(undefined);
    setToken("");
    setSplits([]);
    setEmail("");
    setCode("");
    setSent(false);
    setMessage("");
    router.replace(`/${location.hash}`);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    if (!url || !key)
      throw new Error("Email sign-in needs a dedicated pilot configuration.");
    const normalized = email.trim().toLowerCase();
    const response = await fetch(`${url}/auth/v1/${sent ? "verify" : "otp"}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(
        sent
          ? { email: normalized, token: code, type: "email" }
          : { email: normalized, create_user: true },
      ),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.msg || "Unable to sign in. Please retry.");
    if (sent) {
      setToken(data.access_token);
      setEmail(normalized);
      storeSession(data, normalized);
      await load();
    } else {
      setSent(true);
      setMessage("Enter the code from your email.");
    }
  }
  async function save(body: PilotMutation, inConversation = false) {
    const serialized = JSON.stringify(body);
    const operation =
      pending?.body === serialized
        ? pending
        : { body: serialized, key: crypto.randomUUID() };
    setPending(operation);
    storePending(email, operation);
    const data = await pilotRequest("/api/pilot", {
      method: "POST",
      body: JSON.stringify({ ...body, key: operation.key }),
    });
    if (body.expected === 0)
      void pilotRequest("/api/pilot/measurements", {
        method: "POST",
        body: JSON.stringify({
          type: "published",
          id: data.id,
          splitId: data.id,
        }),
      }).catch(() => {});
    clearPending(email);
    setPending(undefined);
    setViewedRevisions((previous) => ({
      ...previous,
      [data.id]: data.revision,
    }));
    setEditing(undefined);
    await load();
    router.push(
      inConversation ? `/?conversation=${data.id}` : `/?split=${data.id}`,
    );
    setMessage("Saved.");
  }
  async function redeemInvitation() {
    const invitation = new URLSearchParams(location.hash.slice(1)).get(
      "invite",
    );
    if (!invitation) return;
    const result = await pilotRequest("/api/pilot/invitations", {
      method: "POST",
      body: JSON.stringify({ type: "redeem", token: invitation }),
    });
    router.replace(`/?split=${result.splitId}`);
  }
  useEffect(() => {
    if (token)
      void action(async () => {
        await redeemInvitation();
        await load();
      });
    // Redeem only after authentication changes, preserving the link through sign-in.
  }, [Boolean(token)]);
  const visible = selected ? splits.filter((s) => s.id === selected) : [];
  const active = creating
    ? "new"
    : selected || view === "splits"
      ? "splits"
      : "home";
  return (
    <WorkspaceFrame
      active={active}
      title={
        creating
          ? "New split"
          : selected
            ? "Split details"
            : view === "splits"
              ? "Your splits"
              : "SplitFlow"
      }
      conversations={conversations}
      currentConversation={conversationId}
      conversationMode={Boolean(token) && chatting}
      email={token ? email : undefined}
      onSignOut={signOut}
      viewKey={search.toString()}
    >
      <div
        className={
          chatting && token
            ? "workspace-content flex min-h-full flex-col"
            : "workspace-content space-y-5"
        }
      >
        {(busy || loading || message) && (
          <p
            role="status"
            className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-app-blue"
          >
            {busy ? "Working…" : loading ? "Loading your splits…" : message}
          </p>
        )}
        {!token && loading ? (
          <div className="rounded-lg border border-app-border bg-white p-8 text-app-muted">
            Loading your workspace…
          </div>
        ) : !token ? (
          <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2 md:items-center md:py-12">
            <div className="space-y-4">
              <span className="inline-flex rounded-lg bg-blue-50 p-3 text-app-blue">
                <WalletCards className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-3xl font-bold tracking-tight">
                Every outing.
                <br />
                Every share, clear.
              </h2>
              <p className="max-w-sm text-sm leading-6 text-app-muted">
                Record what was paid, show everyone their share, and keep track
                of repayments together.
              </p>
              <p className="flex items-center gap-2 text-sm text-app-muted">
                <CheckCircle2
                  className="h-4 w-4 text-app-green"
                  aria-hidden="true"
                />
                Start with a dinner. No group setup needed.
              </p>
            </div>
            <form
              className="space-y-4 rounded-lg border border-app-border bg-white p-5 shadow-soft md:p-6"
              onSubmit={(e) => {
                e.preventDefault();
                void action(signIn);
              }}
            >
              <h2 className="text-lg font-semibold">Sign in with email</h2>
              <label className="block">
                Email
                <input
                  className="block w-full rounded border p-3"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSent(false);
                  }}
                />
              </label>
              {sent && (
                <label className="block">
                  Email code
                  <input
                    className="block w-full rounded border p-3"
                    required
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              )}
              <button
                disabled={busy}
                className="rounded bg-blue-600 px-4 py-3 text-white"
              >
                {sent ? "Verify code" : "Send email code"}
              </button>
              <p className="text-xs leading-5 text-app-muted">
                A one-time code keeps your splits private. No password to
                remember.
              </p>
            </form>
          </div>
        ) : (
          <>
            {(selected || creating) && (
              <Link
                href="/?view=splits"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-app-muted"
              >
                ← All splits
              </Link>
            )}
            {chatting && !loading && (
              <>
                {conversationError && (
                  <p
                    role="alert"
                    className="mx-auto max-w-3xl px-4 pt-4 text-sm text-red-700"
                  >
                    {conversationError}
                  </p>
                )}
                {conversationId &&
                !conversations.some((c) => c.id === conversationId) &&
                !conversationError ? (
                  <p className="p-6" role="status">
                    This conversation is unavailable for your account.{" "}
                    <Link href="/" className="underline">
                      Start a new conversation
                    </Link>
                  </p>
                ) : (
                  (conversationId || newConversationId) && (
                    <SplitConversation
                      key={`${email}:${conversationId ?? newConversationId}`}
                      email={email}
                      id={conversationId ?? newConversationId}
                      previousSplits={splits}
                      conversation={conversations.find(
                        (c) => c.id === conversationId,
                      )}
                      split={splits.find(
                        (split) => split.id === conversationId,
                      )}
                      onSaved={(chat) => {
                        sessionStorage.removeItem(
                          `splitflow-new-conversation:${email}`,
                        );
                        setConversations((previous) => [
                          chat,
                          ...previous.filter((c) => c.id !== chat.id),
                        ]);
                        router.replace(`/?conversation=${chat.id}`);
                      }}
                      onPublish={async (expense) => {
                        const id = conversationId ?? newConversationId;
                        if (!conversations.some((c) => c.id === id)) {
                          const chat = await pilotRequest(
                            "/api/pilot/conversations",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                id,
                                key: crypto.randomUUID(),
                                expected: 0,
                                draft: expense,
                              }),
                            },
                          );
                          setConversations((previous) => [
                            chat,
                            ...previous.filter((c) => c.id !== chat.id),
                          ]);
                        }
                        await save({ id, expected: 0, expense }, true);
                      }}
                    />
                  )
                )}
              </>
            )}
            {!selected && !creating && !chatting && !loading && (
              <SplitLibrary splits={splits} email={email} />
            )}
            {pending && (
              <div className="rounded border p-3">
                <p>A previous save has not been acknowledged.</p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(() => save(JSON.parse(pending.body)))
                  }
                >
                  Retry interrupted save
                </button>
              </div>
            )}
            {creating && draftId && (
              <ExpenseForm
                email={email}
                busy={busy}
                onDrafted={() => {
                  void pilotRequest("/api/pilot/measurements", {
                    method: "POST",
                    body: JSON.stringify({ type: "ai_used", id: draftId }),
                  }).catch(() => {});
                }}
                onSave={(expense) =>
                  action(() => save({ id: draftId, expected: 0, expense }))
                }
              />
            )}
            {!loading &&
              !creating &&
              !chatting &&
              visible.length === 0 &&
              (selected ? (
                <div className="rounded-lg border border-app-border bg-white p-6">
                  <h2 className="font-bold">
                    This split is unavailable for your email.
                  </h2>
                  <p className="mt-2 text-sm text-app-muted">
                    Ask the organizer to check the participant email.
                  </p>
                </div>
              ) : splits.length === 0 ? (
                <section className="rounded-lg border border-dashed border-app-border bg-white px-5 py-10 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-app-blue">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-xl font-bold">
                    Your first split starts here
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">
                    Add a dinner or outing, review everyone's share, then invite
                    them to settle up. Your shared splits will appear here.
                  </p>
                  <Link
                    href="/?view=new"
                    className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New split
                  </Link>
                </section>
              ) : null)}
            {visible.map((split) => {
              const allocation = calculateExpense(split.expense);
              const remaining = balances(split);
              const mine = allocation.shares[email];
              return (
                <article
                  key={split.id}
                  className="space-y-5 rounded-lg border border-app-border bg-white p-5 md:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">{split.expense.title}</h2>
                    <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-semibold text-app-blue">
                      {split.expense.mode === "paid"
                        ? "Already paid"
                        : "Planned expense"}
                    </span>
                  </div>
                  <p className="font-medium">{nextAction(split, email)}</p>
                  <p>
                    {split.expense.mode === "paid"
                      ? "Already paid"
                      : "Planned expense"}{" "}
                    · Revision {split.revision}
                  </p>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-app-blue">
                      Your share{" "}
                      <span className="mt-1 block text-3xl font-bold tracking-tight text-app-text">
                        {money(mine)}
                      </span>
                    </p>
                  </div>
                  <p>
                    {remaining[email] < 0
                      ? "Still owed to you"
                      : "Your remaining balance"}{" "}
                    {money(Math.abs(remaining[email]))}
                  </p>
                  {split.expense.mode === "paid" && (
                    <ul aria-label="Remaining repayments" className="space-y-2">
                      {settlements(split)
                        .filter(
                          (transfer) =>
                            transfer.from === email || transfer.to === email,
                        )
                        .map((transfer) => (
                          <li key={`${transfer.from}-${transfer.to}`}>
                            {transfer.from === email
                              ? `You owe ${split.expense.participants.find((person) => person.email === transfer.to)?.name}`
                              : `${split.expense.participants.find((person) => person.email === transfer.from)?.name} owes you`}{" "}
                            {money(transfer.amount)}
                          </li>
                        ))}
                    </ul>
                  )}
                  <section aria-label="Participants and shares">
                    <h3 className="mb-2 text-sm font-bold">Participants</h3>
                    <ul className="divide-y divide-app-border rounded-lg border border-app-border">
                      {split.expense.participants.map((p) => (
                        <li key={p.email} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold">{p.name}</span>
                            <span className="font-bold">
                              {money(allocation.shares[p.email])}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-app-muted">
                            Paid {money(p.paid)} ·{" "}
                            {split.responses[p.email]?.status ??
                              (split.expense.mode === "planned"
                                ? "Awaiting response"
                                : "No correction requested")}
                          </p>
                          {split.responses[p.email]?.reason && (
                            <p className="mt-2 text-sm">
                              {split.responses[p.email].reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <details>
                    <summary>How your share was calculated</summary>
                    {split.expense.items.map((item, i) => (
                      <p key={i}>
                        {item.name} · {money(item.amount)} ·{" "}
                        {item.included.includes(email)
                          ? `Your share ${money(itemShare(item, email))} · Included with ${item.included.length} people`
                          : "Excluded"}
                      </p>
                    ))}
                  </details>
                  {split.organizer === email && (
                    <div className="space-y-2">
                      <p>
                        Invite each person using their listed email. Links
                        expire after seven days.
                      </p>
                      {split.expense.participants
                        .filter((p) => p.email !== email)
                        .map((person) => (
                          <button
                            key={person.email}
                            disabled={busy}
                            className="mr-3 rounded border p-3"
                            onClick={() =>
                              void action(async () => {
                                const invitation = await pilotRequest(
                                  "/api/pilot/invitations",
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      type: "issue",
                                      splitId: split.id,
                                      email: person.email,
                                      key: crypto.randomUUID(),
                                    }),
                                  },
                                );
                                await navigator.clipboard.writeText(
                                  `${location.origin}/#invite=${invitation.token}`,
                                );
                                setMessage(
                                  `Invitation for ${person.name} copied. Expires ${new Date(invitation.expiresAt).toLocaleString()}.`,
                                );
                              })
                            }
                          >
                            Copy invitation for {person.name}
                          </button>
                        ))}
                    </div>
                  )}
                  <button
                    disabled={busy}
                    className="underline"
                    onClick={() =>
                      void action(async () => {
                        await navigator.clipboard.writeText(
                          `Please review ${split.expense.title} in SplitFlow: ${location.origin}/?split=${split.id}`,
                        );
                        setMessage(
                          "Reminder copied. New participants need their invitation first.",
                        );
                      })
                    }
                  >
                    Copy reminder
                  </button>
                  {viewedRevisions[split.id] !== split.revision && (
                    <div role="status" className="rounded border p-3">
                      <p>
                        This split changed. Review the latest amounts before
                        responding. An open revision keeps its original version.
                      </p>
                      <button
                        onClick={() =>
                          setViewedRevisions((previous) => ({
                            ...previous,
                            [split.id]: split.revision,
                          }))
                        }
                      >
                        I have reviewed this version
                      </button>
                    </div>
                  )}
                  {split.expense.mode === "planned" && (
                    <div className="flex gap-4">
                      {(["accepted", "declined"] as const).map((status) => (
                        <button
                          disabled={busy}
                          key={status}
                          onClick={() =>
                            void action(() =>
                              save({
                                id: split.id,
                                expected:
                                  viewedRevisions[split.id] ?? split.revision,
                                command: {
                                  type: "respond",
                                  status,
                                  reason: "",
                                },
                              }),
                            )
                          }
                        >
                          {status === "accepted"
                            ? "Accept participation"
                            : "Decline participation"}
                        </button>
                      ))}
                    </div>
                  )}
                  <form
                    aria-label="Request a correction"
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-app-border bg-slate-50 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void action(() =>
                        save({
                          id: split.id,
                          expected: viewedRevisions[split.id] ?? split.revision,
                          command: {
                            type: "respond",
                            status: "correction",
                            reason: String(data.get("reason") ?? ""),
                          },
                        }),
                      );
                    }}
                  >
                    <label>
                      Requested correction
                      <input
                        required
                        name="reason"
                        className="block rounded border p-3"
                        maxLength={500}
                      />
                    </label>
                    <button disabled={busy}>Request correction</button>
                  </form>
                  {split.expense.mode === "paid" && (
                    <form
                      aria-label="Report a repayment"
                      className="flex flex-wrap items-end gap-3 rounded-lg border border-app-border bg-slate-50 p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void action(() =>
                          save({
                            id: split.id,
                            expected:
                              viewedRevisions[split.id] ?? split.revision,
                            command: {
                              type: "report",
                              to: String(data.get("to") ?? ""),
                              amount: Number(data.get("amount")),
                            },
                          }),
                        );
                      }}
                    >
                      <label>
                        Recipient
                        <Select name="to" className="block border p-3">
                          {split.expense.participants
                            .filter((p) => p.email !== email)
                            .map((p) => (
                              <option key={p.email} value={p.email}>
                                {p.name}
                              </option>
                            ))}
                        </Select>
                      </label>
                      <label>
                        Amount sent (KRW)
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          step="1"
                          required
                          className="block w-40 border p-3"
                        />
                      </label>
                      <button disabled={busy}>Report sent</button>
                    </form>
                  )}
                  {split.repayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-lg border border-app-border p-4 text-sm"
                    >
                      <p>
                        {
                          split.expense.participants.find(
                            (person) => person.email === payment.from,
                          )?.name
                        }{" "}
                        →{" "}
                        {
                          split.expense.participants.find(
                            (person) => person.email === payment.to,
                          )?.name
                        }{" "}
                        · {money(payment.amount)} ·{" "}
                        {payment.status === "reported"
                          ? "Reported sent"
                          : payment.status === "confirmed"
                            ? "Confirmed received"
                            : "Disputed"}
                      </p>
                      {payment.to === email &&
                        payment.status === "reported" &&
                        (["confirmed", "disputed"] as const).map((status) => (
                          <button
                            disabled={busy}
                            className="mr-4 underline"
                            key={status}
                            onClick={() =>
                              void action(() =>
                                save({
                                  id: split.id,
                                  expected:
                                    viewedRevisions[split.id] ?? split.revision,
                                  command: {
                                    type: "receipt",
                                    paymentId: payment.id,
                                    status,
                                  },
                                }),
                              )
                            }
                          >
                            {status === "confirmed"
                              ? "Confirm received"
                              : "Dispute"}
                          </button>
                        ))}
                    </div>
                  ))}
                  <SplitHistory id={split.id} revision={split.revision} />
                  <details>
                    <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                      Activity and history
                    </summary>
                    <ol className="mt-3 space-y-3 text-sm">
                      {split.audit
                        .slice()
                        .reverse()
                        .map((event, index) => (
                          <li key={index}>
                            <span className="font-medium">
                              {split.expense.participants.find(
                                (p) => p.email === event.actor,
                              )?.name ?? "Participant"}
                            </span>{" "}
                            · {event.action}
                            <time className="mt-1 block text-xs text-app-muted">
                              {new Date(event.at).toLocaleString()}
                            </time>
                          </li>
                        ))}
                    </ol>
                  </details>
                  {email === split.organizer && (
                    <button
                      onClick={() =>
                        setEditing(
                          editing?.id === split.id
                            ? undefined
                            : {
                                id: split.id,
                                revision: split.revision,
                                expense: structuredClone(split.expense),
                              },
                        )
                      }
                    >
                      {editing?.id === split.id
                        ? "Cancel revision"
                        : "Revise expense"}
                    </button>
                  )}
                  {editing?.id === split.id &&
                    editing.revision !== split.revision && (
                      <button
                        className="rounded border p-3"
                        onClick={() =>
                          setEditing({
                            id: split.id,
                            revision: split.revision,
                            expense: structuredClone(split.expense),
                          })
                        }
                      >
                        Discard draft and use latest expense
                      </button>
                    )}
                  {editing?.id === split.id && (
                    <ExpenseForm
                      email={email}
                      key={`${editing.id}-${editing.revision}`}
                      original={editing.expense}
                      busy={busy}
                      onSave={(expense, reason) =>
                        action(() =>
                          save({
                            id: split.id,
                            expected: editing.revision,
                            command: { type: "revise", expense, reason },
                          }),
                        )
                      }
                    />
                  )}
                </article>
              );
            })}
          </>
        )}
        {token && !chatting && (
          <PilotFeedback
            splitId={
              selected && splits.some((split) => split.id === selected)
                ? selected
                : undefined
            }
          />
        )}
      </div>
    </WorkspaceFrame>
  );
}
