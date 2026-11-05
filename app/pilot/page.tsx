"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  balances,
  calculateExpense,
  itemShare,
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
import { ExpenseForm } from "@/components/pilot-expense-form";
const money = (amount: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
export default function PilotPage() {
  const loadSequence = useRef(0);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [splits, setSplits] = useState<Split[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [editing, setEditing] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [pending, setPending] = useState<{ body: string; key: string }>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  async function load() {
    const sequence = ++loadSequence.current;
    const session = await getSession();
    if (sequence !== loadSequence.current) return;
    if (!session) {
      setToken("");
      setSplits([]);
      setLoading(false);
      return;
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
    setLoading(false);
  }
  useEffect(() => {
    setSelected(new URLSearchParams(location.search).get("split") ?? undefined);
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
  async function save(body: object) {
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
    clearPending(email);
    setPending(undefined);
    setCreating(false);
    setEditing(undefined);
    await load();
    setSelected(data.id);
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
    setSelected(result.splitId);
    history.replaceState(null, "", `/pilot?split=${result.splitId}`);
  }
  useEffect(() => {
    if (token)
      void action(async () => {
        await redeemInvitation();
        await load();
      });
    // Redeem only after authentication changes, preserving the link through sign-in.
  }, [Boolean(token)]);
  const visible = selected ? splits.filter((s) => s.id === selected) : splits;
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dinner splits</h1>
        <Link className="underline" href="/">
          Open demo
        </Link>
      </header>
      <p role="status" className="text-sm">
        {busy ? "Working…" : loading ? "Loading your splits…" : message}
      </p>
      {!token ? (
        <form
          className="space-y-4 rounded-lg border bg-white p-5"
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
        </form>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            <button
              className="rounded bg-blue-600 p-3 text-white"
              onClick={() => {
                setDraftId(crypto.randomUUID());
                setCreating(true);
                setSelected(undefined);
              }}
            >
              New split
            </button>
            <button
              className="underline"
              onClick={() => setSelected(undefined)}
            >
              All splits
            </button>
            <button
              onClick={() => {
                loadSequence.current += 1;
                clearSession();
                setCreating(false);
                setEditing(undefined);
                setPending(undefined);
                setToken("");
                setSplits([]);
              }}
            >
              Sign out
            </button>
          </div>
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
          {creating && (
            <ExpenseForm
              email={email}
              busy={busy}
              onSave={(expense) =>
                action(() => save({ id: draftId, expected: 0, expense }))
              }
            />
          )}
          {!loading && !creating && visible.length === 0 && (
            <p>
              {selected
                ? "This split is unavailable for your email. Ask the organizer to check the participant email."
                : "Your shared splits will appear here."}
            </p>
          )}
          {visible.map((split) => {
            const allocation = calculateExpense(split.expense);
            const remaining = balances(split);
            const mine = allocation.shares[email];
            return (
              <article
                key={split.id}
                className="space-y-4 rounded-lg border bg-white p-5"
              >
                <h2 className="text-xl font-semibold">{split.expense.title}</h2>
                <p className="font-medium">{nextAction(split, email)}</p>
                <p>
                  {split.expense.mode === "paid"
                    ? "Already paid"
                    : "Planned expense"}{" "}
                  · Revision {split.revision}
                </p>
                <p className="text-2xl">Your share {money(mine)}</p>
                <p>
                  {remaining[email] < 0
                    ? "Still owed to you"
                    : "Your remaining balance"}{" "}
                  {money(Math.abs(remaining[email]))}
                </p>
                <ul className="space-y-2">
                  {split.expense.participants.map((p) => (
                    <li key={p.email}>
                      {p.name} · Share {money(allocation.shares[p.email])} ·
                      Paid {money(p.paid)} ·{" "}
                      {split.responses[p.email]?.status ??
                        (split.expense.mode === "planned"
                          ? "Awaiting response"
                          : "No correction requested")}
                    </li>
                  ))}
                </ul>
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
                      Invite each person using their listed email. Links expire
                      after seven days.
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
                                `${location.origin}/pilot#invite=${invitation.token}`,
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
                        `Please review ${split.expense.title} in SplitFlow: ${location.origin}/pilot?split=${split.id}`,
                      );
                      setMessage(
                        "Reminder copied. New participants need their invitation first.",
                      );
                    })
                  }
                >
                  Copy reminder
                </button>
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
                              expected: split.revision,
                              command: { type: "respond", status, reason: "" },
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
                  className="flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void action(() =>
                      save({
                        id: split.id,
                        expected: split.revision,
                        command: {
                          type: "respond",
                          status: "correction",
                          reason: data.get("reason"),
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
                    className="flex flex-wrap gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void action(() =>
                        save({
                          id: split.id,
                          expected: split.revision,
                          command: {
                            type: "report",
                            to: data.get("to"),
                            amount: Number(data.get("amount")),
                          },
                        }),
                      );
                    }}
                  >
                    <label>
                      Recipient
                      <select name="to" className="block border p-3">
                        {split.expense.participants
                          .filter((p) => p.email !== email)
                          .map((p) => (
                            <option key={p.email} value={p.email}>
                              {p.name}
                            </option>
                          ))}
                      </select>
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
                  <div key={payment.id}>
                    <p>
                      {payment.from} → {payment.to} · {money(payment.amount)} ·{" "}
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
                                expected: split.revision,
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
                {email === split.organizer && (
                  <button
                    onClick={() =>
                      setEditing(editing === split.id ? undefined : split.id)
                    }
                  >
                    Revise expense
                  </button>
                )}
                {editing === split.id && (
                  <ExpenseForm
                    email={email}
                    original={split.expense}
                    busy={busy}
                    onSave={(expense, reason) =>
                      action(() =>
                        save({
                          id: split.id,
                          expected: split.revision,
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
      <a
        className="block underline"
        href="https://github.com/syahmiharith/splitflow/issues"
      >
        Report a problem
      </a>
    </main>
  );
}
