import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pilot/route";
import { POST as invitation } from "@/app/api/pilot/invitations/route";
const userId = "11111111-1111-4111-8111-111111111111";
const splitId = "22222222-2222-4222-8222-222222222222";
const key = "33333333-3333-4333-8333-333333333333";
function request(path: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer verified-session" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("pilot API access and recovery", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://pilot.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  function authenticated() {
    return response({
      id: userId,
      email: "person@example.com",
      email_confirmed_at: "2026-11-05",
    });
  }
  it("requires a verified session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 401)));
    expect((await GET(request("/api/pilot"))).status).toBe(401);
  });
  it("lists only joined memberships", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(authenticated())
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal("fetch", fetch);
    expect(await (await GET(request("/api/pilot"))).json()).toEqual([]);
    expect(fetch.mock.calls[1][0]).toContain(
      `pilot_memberships?user_id=eq.${userId}`,
    );
  });
  it("rejects edits from unredeemed listed participants", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(authenticated())
        .mockResolvedValueOnce(response([]))
        .mockResolvedValueOnce(response([])),
    );
    const result = await POST(
      request("/api/pilot", {
        id: splitId,
        key,
        expected: 1,
        command: { type: "respond", status: "accepted", reason: "" },
      }),
    );
    expect(result.status).toBe(403);
  });
  it("replays an interrupted successful operation before checking the old revision", async () => {
    const saved = { id: splitId, revision: 2 };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(authenticated())
        .mockResolvedValueOnce(response([{ split_id: splitId, result: saved }]))
        .mockResolvedValueOnce(response([{ role: "participant" }])),
    );
    const result = await POST(
      request("/api/pilot", {
        id: splitId,
        key,
        expected: 1,
        command: { type: "respond", status: "accepted", reason: "" },
      }),
    );
    expect(await result.json()).toEqual(saved);
  });
  it("rejects reused operation keys for another split", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(authenticated())
        .mockResolvedValueOnce(
          response([{ split_id: crypto.randomUUID(), result: {} }]),
        ),
    );
    expect(
      (await POST(request("/api/pilot", { id: splitId, key, expected: 1 })))
        .status,
    ).toBe(400);
  });
  it("returns an actionable wrong-account invitation error without the email", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(authenticated())
        .mockResolvedValueOnce(
          response({ message: "INVITATION_ACCOUNT" }, 400),
        ),
    );
    const result = await invitation(
      request("/api/pilot/invitations", {
        type: "redeem",
        token: "a".repeat(64),
      }),
    );
    expect(result.status).toBe(403);
    expect(await result.text()).toContain("Sign in with the email");
  });
  it("returns an expired invitation recovery message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(authenticated())
        .mockResolvedValueOnce(
          response({ message: "INVITATION_EXPIRED" }, 400),
        ),
    );
    expect(
      (
        await invitation(
          request("/api/pilot/invitations", {
            type: "redeem",
            token: "b".repeat(64),
          }),
        )
      ).status,
    ).toBe(410);
  });
  it("read-only recovery mode stops financial and invitation writes", async () => {
    vi.stubEnv("PILOT_READ_ONLY", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (await POST(request("/api/pilot", { id: splitId, key, expected: 1 })))
        .status,
    ).toBe(503);
    expect(
      (
        await invitation(
          request("/api/pilot/invitations", {
            type: "redeem",
            token: "a".repeat(64),
          }),
        )
      ).status,
    ).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("denies operation replay after membership is revoked", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(authenticated())
        .mockResolvedValueOnce(
          response([{ split_id: splitId, result: { id: splitId } }]),
        )
        .mockResolvedValueOnce(response([])),
    );
    expect(
      (await POST(request("/api/pilot", { id: splitId, key, expected: 1 })))
        .status,
    ).toBe(403);
  });
});
