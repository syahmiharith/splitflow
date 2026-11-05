import { z } from "zod";
const sessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  email: z.email(),
});
export type PilotSession = z.infer<typeof sessionSchema>;
const storageKey = "splitflow-pilot-session";
export function clearSession() {
  localStorage.removeItem(storageKey);
}
export function storeSession(
  data: { access_token: string; refresh_token: string; expires_in: number },
  email: string,
) {
  const session = sessionSchema.parse({
    ...data,
    email,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  });
  localStorage.setItem(storageKey, JSON.stringify(session));
  return session;
}
function readSession(): PilotSession | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? sessionSchema.parse(JSON.parse(raw)) : null;
  } catch {
    clearSession();
    return null;
  }
}
let refreshing: Promise<PilotSession | null> | undefined;
export async function getSession(): Promise<PilotSession | null> {
  const session = readSession();
  if (!session || session.expires_at > Date.now() / 1000 + 60) return session;
  if (refreshing) return refreshing;
  const refresh = async () => {
    const current = readSession();
    if (!current || current.expires_at > Date.now() / 1000 + 60) return current;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      throw new Error("Email sign-in needs pilot configuration.");
    const response = await fetch(
      `${url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      },
    );
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        if (readSession()?.refresh_token === current.refresh_token)
          clearSession();
        return readSession();
      }
      throw new Error("Unable to renew your session. Retry when connected.");
    }
    const data = await response.json();
    const latest = readSession();
    if (!latest || latest.refresh_token !== current.refresh_token)
      return latest;
    return storeSession(data, current.email);
  };
  refreshing = (async () => {
    if (navigator.locks)
      return await navigator.locks.request("splitflow-auth-refresh", refresh);
    return await refresh();
  })().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}
export async function pilotRequest(path: string, init: RequestInit = {}) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to continue.");
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    if (
      response.status === 401 &&
      readSession()?.access_token === session.access_token
    )
      clearSession();
    throw new Error(data.error ?? "Unable to complete this action.");
  }
  return data;
}
