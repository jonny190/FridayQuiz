import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    text?: string;
    answer?: string;
    points?: number;
    explanation?: string | null;
  } = {};

  if (typeof body.text === "string") {
    const t = body.text.trim();
    if (!t) {
      return NextResponse.json(
        { error: "Question text cannot be empty" },
        { status: 400 }
      );
    }
    data.text = t;
  }
  if (typeof body.answer === "string") data.answer = body.answer.trim();
  if (typeof body.points === "number" && Number.isFinite(body.points)) {
    data.points = body.points;
  }
  if ("explanation" in body) {
    data.explanation =
      typeof body.explanation === "string"
        ? body.explanation.trim() || null
        : null;
  }

  const updated = await prisma.question.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await prisma.$transaction([
      prisma.suggestion.deleteMany({ where: { questionId: id } }),
      prisma.quizAnswer.deleteMany({ where: { questionId: id } }),
      prisma.question.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}
