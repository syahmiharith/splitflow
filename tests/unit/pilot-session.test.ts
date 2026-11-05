import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSession, storeSession } from "@/lib/pilot/session";
describe("pilot session recovery", () => {
  beforeEach(() => {
    clearSession();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://pilot.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  });
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("recovers a persisted unexpired session", async () => {
    storeSession(
      { access_token: "access", refresh_token: "refresh", expires_in: 3600 },
      "a@example.com",
    );
    expect((await getSession())?.access_token).toBe("access");
  });
  it("renews once for concurrent callers", async () => {
    storeSession(
      { access_token: "old", refresh_token: "refresh", expires_in: 0 },
      "a@example.com",
    );
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "new",
            refresh_token: "rotated",
            expires_in: 3600,
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const results = await Promise.all([getSession(), getSession()]);
    expect(results.map((s) => s?.access_token)).toEqual(["new", "new"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("clears a rejected refresh token", async () => {
    storeSession(
      { access_token: "old", refresh_token: "revoked", expires_in: 0 },
      "a@example.com",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 400 })),
    );
    expect(await getSession()).toBeNull();
  });
  it("retains the refresh token through transient failures", async () => {
    storeSession(
      { access_token: "old", refresh_token: "refresh", expires_in: 0 },
      "a@example.com",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    await expect(getSession()).rejects.toThrow("Retry when connected");
    expect(localStorage.getItem("splitflow-pilot-session")).toContain(
      "refresh",
    );
  });
  it("recovers safely from malformed stored sessions", async () => {
    localStorage.setItem("splitflow-pilot-session", "{broken");
    expect(await getSession()).toBeNull();
  });
});
