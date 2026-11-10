import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pilot/conversations/route";
import { GET as history } from "@/app/api/pilot/history/route";
vi.mock("@/lib/pilot/conversation-agent", () => ({
  draftConversation: vi.fn(),
}));
import { draftConversation } from "@/lib/pilot/conversation-agent";
const owner = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  key = "33333333-3333-4333-8333-333333333333";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const auth = () =>
  json({ id: owner, email: "a@example.com", email_confirmed_at: "2026-11-07" });
const req = (body?: unknown) =>
  new NextRequest("http://localhost/api/pilot/conversations", {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer session" },
    body: body ? JSON.stringify(body) : undefined,
  });
describe("account-private conversations", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://pilot.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-only");
    vi.mocked(draftConversation).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("requires authentication and scopes the history list to the verified owner", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetch);
    expect(await (await GET(req())).json()).toEqual([]);
    expect(fetch.mock.calls[1][0]).toContain(`owner=eq.${owner}`);
    expect(
      (await GET(new NextRequest("http://localhost/api/pilot/conversations")))
        .status,
    ).toBe(401);
  });
  it("replays successful lost responses without generating a second reply", async () => {
    const saved = { id, revision: 1 };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(auth())
        .mockResolvedValueOnce(json([{ conversation_id: id, result: saved }])),
    );
    expect(
      await (
        await POST(req({ id, key, expected: 0, message: "Dinner" }))
      ).json(),
    ).toEqual(saved);
    expect(draftConversation).not.toHaveBeenCalled();
  });
  it("requires fresh review when a second session has changed the conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(auth())
        .mockResolvedValueOnce(json([]))
        .mockResolvedValueOnce(
          json([{ document: { id, revision: 2, messages: [] } }]),
        ),
    );
    expect(
      (await POST(req({ id, key, expected: 1, message: "Change it" }))).status,
    ).toBe(409);
    expect(draftConversation).not.toHaveBeenCalled();
  });
  it("commits the user message and recovery guidance when AI is unavailable", async () => {
    vi.mocked(draftConversation).mockRejectedValue(
      new Error("provider secret details"),
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([]))
      .mockImplementationOnce(async (_url, init) =>
        json(JSON.parse(init.body).p_document),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await (
      await POST(req({ id, key, expected: 0, message: "Dinner was 60000" }))
    ).json();
    expect(result.messages[0].content).toBe("Dinner was 60000");
    expect(result.messages[1].content).toContain("Your message is saved");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.draft).toBeNull();
    expect(fetch.mock.calls[3][0]).toContain("rpc/save_pilot_conversation");
    expect(JSON.parse(fetch.mock.calls[3][1].body).p_owner).toBe(owner);
  });
  it("cannot write financial obligations or receipts through a conversation request", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(auth());
    vi.stubGlobal("fetch", fetch);
    const result = await POST(
      req({
        id,
        key,
        expected: 0,
        command: { type: "receipt", status: "confirmed" },
      }),
    );
    expect(result.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid draft money before persisting a conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(auth())
        .mockResolvedValueOnce(json([]))
        .mockResolvedValueOnce(json([])),
    );
    expect(
      (
        await POST(
          req({
            id,
            key,
            expected: 0,
            draft: {
              title: "Dinner",
              mode: "paid",
              participants: [
                { email: "a@example.com", name: "A", paid: 0 },
                { email: "b@example.com", name: "B", paid: 0 },
              ],
              items: [
                {
                  name: "Dinner",
                  amount: 60000,
                  included: ["a@example.com", "b@example.com"],
                },
              ],
            },
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("does not expose revision history to an unrelated signed-in account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await history(
          new NextRequest(`http://localhost/api/pilot/history?split=${id}`, {
            headers: { Authorization: "Bearer session" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
