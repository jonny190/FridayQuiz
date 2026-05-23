import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster, requireUser } from "@/lib/sessionGuards";
import { parseMemberEmails } from "@/lib/teamMembers";

type Params = { params: Promise<{ id: string }> };

const memberSelect = {
  id: true,
  invitedAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { invitedAt: "asc" },
        select: memberSelect,
      },
      _count: { select: { members: true } },
    },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  return NextResponse.json(team);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: { name?: string; contactEmail?: string; isActive?: boolean } = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      const clash = await prisma.team.findFirst({
        where: {
          name: { mode: "insensitive", equals: name },
          NOT: { id },
        },
      });
      if (clash) {
        return NextResponse.json(
          { error: "Team name already exists" },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if (typeof body?.contactEmail === "string") {
      const email = body.contactEmail.trim();
      if (!email) {
        return NextResponse.json(
          { error: "Contact email cannot be empty" },
          { status: 400 }
        );
      }
      data.contactEmail = email;
    }
    if (typeof body?.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    await prisma.team.update({ where: { id }, data });

    // Keep the (possibly new) contact email synced as an OWNER member.
    const effectiveContact = (data.contactEmail ?? team.contactEmail)?.toLowerCase();
    if (effectiveContact) {
      const contactUser = await prisma.user.upsert({
        where: { email: effectiveContact },
        update: {},
        create: { email: effectiveContact, role: "MEMBER" },
      });
      await prisma.teamMember.upsert({
        where: { userId_teamId: { userId: contactUser.id, teamId: id } },
        update: { role: "OWNER" },
        create: { userId: contactUser.id, teamId: id, role: "OWNER" },
      });
    }

    const newMemberEmails = parseMemberEmails(body?.addMembers);
    for (const email of newMemberEmails) {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, role: "MEMBER" },
      });
      await prisma.teamMember.upsert({
        where: { userId_teamId: { userId: user.id, teamId: id } },
        update: {},
        create: { userId: user.id, teamId: id },
      });
    }

    const updated = await prisma.team.findUnique({
      where: { id },
      include: {
        members: { orderBy: { invitedAt: "asc" }, select: memberSelect },
        _count: { select: { members: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating team:", error);
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await prisma.$transaction([
      prisma.suggestion.deleteMany({ where: { teamId: id } }),
      prisma.quizAnswer.deleteMany({ where: { teamId: id } }),
      prisma.quizResult.deleteMany({ where: { teamId: id } }),
      prisma.teamMember.deleteMany({ where: { teamId: id } }),
      prisma.team.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
