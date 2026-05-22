import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/sessionGuards";

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const user = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const data: { firstName?: string | null; lastName?: string | null } = {};

    if ("firstName" in (body ?? {})) {
      const v = body.firstName;
      data.firstName =
        typeof v === "string" ? v.trim() || null : v === null ? null : undefined;
    }
    if ("lastName" in (body ?? {})) {
      const v = body.lastName;
      data.lastName =
        typeof v === "string" ? v.trim() || null : v === null ? null : undefined;
    }

    const updated = await prisma.user.update({
      where: { id: guard.user.id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
