import { expect, type Page } from "@playwright/test";

/** Local-only account setup. Each side uses its own authenticated API request. */
export async function ensureLocalMutualFriends(page: Page, peers: string[]) {
  if (process.env.SUPABASE_URL !== "http://127.0.0.1:55421")
    throw Error("Friend fixtures are restricted to isolated local Supabase.");
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("splitflow-pilot-session")!));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  for (const email of peers.filter(email => email !== session.email)) {
    const existing = await page.request.get("/api/workspace", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const rows = await existing.json();
    if (rows.some((r: { document: { friendship?: boolean; joined?: string[] } }) => r.document.friendship && r.document.joined?.includes(email) && r.document.joined?.includes(session.email))) continue;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const created = await page.request.post(`${url}/auth/v1/admin/users`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      data: { email, password, email_confirm: true },
    });
    expect(created.ok()).toBe(true);
    const signed = await page.request.post(`${url}/auth/v1/token?grant_type=password`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, data: { email, password },
    });
    expect(signed.ok()).toBe(true);
    const other = await signed.json();
    const id = crypto.randomUUID();
    const requested = await page.request.post("/api/workspace", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { id, key: crypto.randomUUID(), kind: "group", expected: 0, input: { name: "Friendship", friendship: true, people: [{ email: session.email, name: "Organizer" }, { email, name: "Friend" }] } },
    });
    expect(requested.ok()).toBe(true);
    const accepted = await page.request.post("/api/workspace", {
      headers: { Authorization: `Bearer ${other.access_token}` },
      data: { id, key: crypto.randomUUID(), kind: "group", expected: 1, command: { type: "join" } },
    });
    expect(accepted.ok()).toBe(true);
  }
}
