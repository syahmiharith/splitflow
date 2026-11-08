import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/workspace/route";
const id = "81000000-0000-4000-8000-000000000001",
  key = "82000000-0000-4000-8000-000000000001",
  uid = "83000000-0000-4000-8000-000000000001";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const auth = () =>
  json({ id: uid, email: "a@example.test", email_confirmed_at: "2026-11-08" });
const request = (data?: unknown) =>
  new NextRequest("http://localhost/api/workspace", {
    method: data ? "POST" : "GET",
    headers: { Authorization: "Bearer signed-session" },
    body: data ? JSON.stringify(data) : undefined,
  });
const input = {
  id,
  key,
  kind: "activity",
  expected: 0,
  input: {
    title: "Activity",
    kind: "quick",
    people: [
      { name: "A", email: "a@example.test" },
      { name: "B", email: "b@example.test" },
    ],
  },
};
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test.example");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("shared workspace boundary", () => {
  it("filters by the verified email", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetch);
    expect((await GET(request())).status).toBe(200);
    expect(decodeURIComponent(fetch.mock.calls[1][0])).toContain(
      'members=cs.{"a@example.test"}',
    );
  });
  it("derives the owner and actor instead of accepting client identity", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([]))
      .mockImplementationOnce(async (_url, init) =>
        json(JSON.parse(init.body).p_document),
      );
    vi.stubGlobal("fetch", fetch);
    const response = await POST(
      request({ ...input, input: { ...input.input, owner: "b@example.test" } }),
    );
    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(doc.owner).toBe("a@example.test");
    expect(JSON.parse(fetch.mock.calls[3][1].body).p_actor).toBe(uid);
  });
  it("denies unrelated account reads through mutation and does not replay private results", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(
        json([
          {
            kind: "activity",
            document: { people: [{ email: "other@example.test" }] },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await POST(
          request({
            ...input,
            expected: 1,
            command: { type: "message", text: "Hi" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("requires joined group members before creating a group activity", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(
        json([{ document: { joined: ["a@example.test"] } }]),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await POST(
          request({
            ...input,
            input: { ...input.input, groupId: crypto.randomUUID() },
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("replays a lost response without a second mutation", async () => {
    const current = { id, people: input.input.people, revision: 2 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([{ kind: "activity", document: current }]))
      .mockResolvedValueOnce(json([{ record_id: id, result: current }]));
    vi.stubGlobal("fetch", fetch);
    expect(await (await POST(request(input))).json()).toEqual(current);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
