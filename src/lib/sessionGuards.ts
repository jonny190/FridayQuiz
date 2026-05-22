import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  role: "QUIZMASTER" | "MEMBER";
};

type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function asUser(session: unknown): SessionUser | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const { id, email, role } = user as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof email !== "string" ||
    (role !== "QUIZMASTER" && role !== "MEMBER")
  ) {
    return null;
  }
  return { id, email, role };
}

export async function requireUser(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  const user = asUser(session);
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, user };
}

export async function requireQuizmaster(): Promise<GuardResult> {
  const guard = await requireUser();
  if (!guard.ok) return guard;
  if (guard.user.role !== "QUIZMASTER") {
    return { ok: false, response: forbidden() };
  }
  return guard;
}
