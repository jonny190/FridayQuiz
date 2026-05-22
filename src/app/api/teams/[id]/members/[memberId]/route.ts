import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string; memberId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id, memberId } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
