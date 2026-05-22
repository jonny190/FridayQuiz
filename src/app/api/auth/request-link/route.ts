import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRandomToken } from "@/lib/utils";
import { sendMagicLinkEmail } from "@/lib/email";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const GENERIC_OK = NextResponse.json({ ok: true });

function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export async function POST(request: NextRequest) {
  let email: unknown;
  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return GENERIC_OK;
  }

  if (!isValidEmail(email)) {
    return GENERIC_OK;
  }

  const normalised = email.trim().toLowerCase();

  let user = await prisma.user.findUnique({ where: { email: normalised } });

  // Bootstrap: allow QUIZMASTER_EMAIL to sign in on a fresh deploy
  // even though no user record exists yet.
  if (!user) {
    const quizmasterEmail = process.env.QUIZMASTER_EMAIL?.toLowerCase();
    if (quizmasterEmail && quizmasterEmail === normalised) {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        user = await prisma.user.create({
          data: { email: normalised, role: "QUIZMASTER" },
        });
      }
    }
  }

  if (!user) {
    return GENERIC_OK;
  }

  const token = generateRandomToken(48);
  const expiry = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { magicToken: token, magicTokenExpiry: expiry },
  });

  await sendMagicLinkEmail(user.email, token);

  return GENERIC_OK;
}
