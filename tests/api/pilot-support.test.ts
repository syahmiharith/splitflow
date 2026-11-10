import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as feedback } from "@/app/api/pilot/feedback/route";
import { POST as measurement } from "@/app/api/pilot/measurements/route";
const user = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const json = (data: unknown) => new Response(JSON.stringify(data));
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/pilot/support", {
    method: "POST",
    headers: { Authorization: "Bearer session" },
    body: JSON.stringify(body),
  });
describe("private pilot support", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://pilot.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  function fetchWith(result: unknown) {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          id: user,
          email: "actor@example.com",
          email_confirmed_at: "today",
        }),
      )
      .mockResolvedValueOnce(json(result));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  it("stores feedback under the verified actor with idempotent insert headers", async () => {
    const fetch = fetchWith([]);
    const response = await feedback(
      request({
        id,
        expected: "Expected result",
        actual: "Observed result",
        user_id: "forged",
      }),
    );
    expect(response.status).toBe(200);
    const init = fetch.mock.calls[1][1];
    expect(JSON.parse(init.body).user_id).toBe(user);
    expect(init.headers.Prefer).toContain("ignore-duplicates");
  });
  it("collects completion starts without free text or email fields", async () => {
    const fetch = fetchWith([]);
    expect(
      (
        await measurement(
          request({
            type: "started",
            id,
            email: "sensitive@example.com",
            description: "private expense",
          }),
        )
      ).status,
    ).toBe(200);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      id,
      user_id: user,
    });
  });
  it("requires organizer membership before marking an expense published", async () => {
    const fetch = fetchWith([{ role: "participant" }]);
    expect(
      (await measurement(request({ type: "published", id, splitId: id })))
        .status,
    ).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps feedback private when split access has been removed", async () => {
    fetchWith([]);
    expect(
      (
        await feedback(
          request({
            id,
            splitId: id,
            expected: "Expected",
            actual: "Observed",
          }),
        )
      ).status,
    ).toBe(403);
  });
});
