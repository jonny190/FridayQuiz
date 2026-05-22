import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  const points =
    typeof body?.points === "number" && Number.isFinite(body.points)
      ? body.points
      : 1;

  if (!text) {
    return NextResponse.json(
      { error: "Question text is required" },
      { status: 400 }
    );
  }

  const lastOrder = await prisma.question.findFirst({
    where: { quizId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const question = await prisma.question.create({
    data: {
      quizId: id,
      order: (lastOrder?.order ?? 0) + 1,
      type: "TEXT",
      text,
      answer,
      points,
    },
  });

  return NextResponse.json(question);
}
