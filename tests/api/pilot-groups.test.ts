import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pilot/groups/route";
const owner = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  key = "33333333-3333-4333-8333-333333333333";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const auth = () =>
  json({ id: owner, email: "a@example.com", email_confirmed_at: "2026-11-08" });
const body = {
  id,
  key,
  expected: 0,
  name: "Dinner friends",
  people: [
    { name: "A", email: "a@example.com" },
    { name: "B", email: "b@example.com" },
  ],
};
const request = (data?: unknown) =>
  new NextRequest("http://localhost/api/pilot/groups", {
    method: data ? "POST" : "GET",
    headers: { Authorization: "Bearer session" },
    body: data ? JSON.stringify(data) : undefined,
  });
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://pilot.example");
  vi.stubEnv("SUPABASE_SECRET_KEY", "server-only");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("private reusable group operations", () => {
  it("reads only the verified owner's groups", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetch);
    expect(await (await GET(request())).json()).toEqual([]);
    expect(fetch.mock.calls[1][0]).toContain(`owner=eq.${owner}`);
  });
  it("cannot spoof the group owner or create invitations through saved people", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(auth())
      .mockImplementationOnce(async (_url, init) =>
        json(JSON.parse(init.body).p_document),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await POST(request({ ...body, owner: "another-user" }));
    expect(result.status).toBe(200);
    const operation = JSON.parse(fetch.mock.calls[1][1].body);
    expect(operation.p_owner).toBe(owner);
    expect(operation.p_document.owner).toBeUndefined();
    expect(fetch.mock.calls[1][0]).toContain("rpc/save_pilot_group");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects duplicate emails and requires the signed-in person", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => auth()),
    );
    expect(
      (
        await POST(
          request({ ...body, people: [body.people[0], body.people[0]] }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({
            ...body,
            people: [body.people[1], { name: "C", email: "c@example.com" }],
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("returns a group-specific stale edit message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(auth())
        .mockResolvedValueOnce(json({ message: "STALE_REVISION" }, 400)),
    );
    const result = await POST(request(body));
    expect(result.status).toBe(409);
    expect(await result.text()).toContain("group changed");
  });
  it("blocks writes in read-only recovery mode", async () => {
    vi.stubEnv("PILOT_READ_ONLY", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await POST(request(body))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
