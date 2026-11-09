import { afterEach, expect, it, vi } from "vitest";
import { sendBrevo } from "@/lib/notifications/delivery";
afterEach(() => vi.unstubAllEnvs());
it("requires server configuration without attempting delivery", async () => {
 vi.stubEnv("BREVO_API_KEY", ""); const fetcher = vi.fn();
 await expect(sendBrevo({recipient:"test@example.test",subject:"Invitation",text:"Review",eventKey:"event"},fetcher)).rejects.toThrow("not configured");
 expect(fetcher).not.toHaveBeenCalled();
});
it("returns provider acceptance, carrying a stable idempotency key", async () => {
 vi.stubEnv("BREVO_API_KEY","test-only"); vi.stubEnv("NOTIFICATION_FROM_EMAIL","sender@example.test");
 const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({messageId:"provider-id"}),{status:201}));
 expect(await sendBrevo({recipient:"test@example.test",subject:"Invitation",text:"Review",eventKey:"event"},fetcher)).toBe("provider-id");
 expect(JSON.parse(fetcher.mock.calls[0][1].body).headers.idempotencyKey).toBe("event");
});
