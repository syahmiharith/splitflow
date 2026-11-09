export class MailRateLimited extends Error {}
export type Mail = { recipient: string; subject: string; text: string; eventKey: string };
/** A successful API response means provider acceptance, not delivery or reading. */
export async function sendBrevo(mail: Mail, fetcher: typeof fetch = fetch): Promise<string> {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.NOTIFICATION_FROM_EMAIL;
  if (!key || !sender) throw Error("Notification delivery is not configured.");
  const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { email: sender, name: "SplitFlow" }, to: [{ email: mail.recipient }], subject: mail.subject, textContent: mail.text,
      headers: { "idempotencyKey": mail.eventKey } }),
  });
  if (response.status === 429) throw new MailRateLimited("Mail provider rate limited the request.");
  if (!response.ok) throw Error(`Mail provider rejected the request (${response.status}).`);
  const result = await response.json();
  if (typeof result.messageId !== "string") throw Error("Mail provider did not acknowledge the request.");
  return result.messageId;
}
