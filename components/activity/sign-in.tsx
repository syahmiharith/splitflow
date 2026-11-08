"use client";
import { useState } from "react";
import { storeSession } from "@/lib/pilot/session";
export function ActivitySignIn({
  onSignedIn,
}: {
  onSignedIn: (email: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
            key =
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          if (!url || !key)
            throw Error("Sign-in is unavailable. Please retry later.");
          const normalized = email.trim().toLowerCase();
          const response = await fetch(
            `${url}/auth/v1/${sent ? "verify" : "otp"}`,
            {
              method: "POST",
              headers: { apikey: key, "Content-Type": "application/json" },
              body: JSON.stringify(
                sent
                  ? { email: normalized, token: code, type: "email" }
                  : { email: normalized, create_user: true },
              ),
            },
          );
          const data = await response.json();
          if (!response.ok) throw Error(data.msg || "Unable to sign in.");
          if (sent) {
            storeSession(data, normalized);
            onSignedIn(normalized);
          } else setSent(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to sign in.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-app-muted">
        Sign in to save real activities and share them with your group. Sample
        records stay in the guest workspace.
      </p>
      <label className="block text-sm">
        Email
        <input
          required
          type="email"
          value={email}
          disabled={sent || busy}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border p-3"
        />
      </label>
      {sent && (
        <label className="block text-sm">
          Email code
          <input
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 block w-full rounded-lg border p-3"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 rounded-lg bg-slate-900 px-4 text-white"
      >
        {busy ? "Please wait…" : sent ? "Sign in" : "Send email code"}
      </button>
      {sent && (
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setCode("");
          }}
          className="ml-3 min-h-11 underline"
        >
          Use another email or resend
        </button>
      )}
    </form>
  );
}
