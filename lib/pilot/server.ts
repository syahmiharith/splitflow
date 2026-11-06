import { NextRequest, NextResponse } from "next/server";
export class PilotError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function pilotConfig() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new PilotError("Pilot storage is not configured.", 503);
  return { url, key };
}
export async function database(path: string, init?: RequestInit) {
  const { url, key } = pilotConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      ...(key.startsWith("sb_secret_")
        ? {}
        : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    if (body.includes("STALE_REVISION"))
      throw new PilotError(
        "This split changed. Reload and review before retrying.",
        409,
      );
    if (body.includes("INVITATION_EXPIRED"))
      throw new PilotError(
        "This invitation expired. Ask the organizer for a new link.",
        410,
      );
    if (body.includes("INVITATION_ACCOUNT"))
      throw new PilotError(
        "Sign in with the email this invitation was sent to.",
        403,
      );
    if (body.includes("ACCESS_DENIED"))
      throw new PilotError("Split unavailable for this account.", 403);
    throw new PilotError(
      "Unable to save or load the split. Retry with the same submission.",
      503,
    );
  }
  return response.json();
}
export async function actor(request: NextRequest) {
  const { url, key } = pilotConfig();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new PilotError("Sign in to continue.", 401);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization },
    cache: "no-store",
  });
  if (!response.ok)
    throw new PilotError("Your session expired. Sign in again.", 401);
  const user = await response.json();
  if (!user.email_confirmed_at || !user.email)
    throw new PilotError("Verify your email to continue.", 401);
  return { id: user.id as string, email: (user.email as string).toLowerCase() };
}
export function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete this action.",
    },
    { status: error instanceof PilotError ? error.status : 400 },
  );
}
export async function requireMembership(splitId: string, userId: string) {
  const memberships = await database(
    `pilot_memberships?split_id=eq.${splitId}&user_id=eq.${userId}&select=role`,
  );
  if (!memberships.length)
    throw new PilotError("Split unavailable for this account.", 403);
  return memberships[0].role as "organizer" | "participant";
}

export function requireWritable() {
  if (process.env.PILOT_READ_ONLY === "true")
    throw new PilotError(
      "The pilot is temporarily read-only. Your saved splits remain available. Please retry later.",
      503,
    );
}
