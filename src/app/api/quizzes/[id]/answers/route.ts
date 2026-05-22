import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

// Bulk-update correct answers (and optionally points) for the
// questions of a quiz. Body: { answers: [{ id, answer, points? }] }.
export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const answers = Array.isArray(body?.answers) ? body.answers : null;
  if (!answers) {
    return NextResponse.json({ error: "answers array required" }, { status: 400 });
  }

  const existing = await prisma.question.findMany({
    where: { quizId: id },
    select: { id: true },
  });
  const validIds = new Set(existing.map((q) => q.id));

  const updates: { id: string; answer: string; points?: number }[] = [];
  for (const row of answers) {
    if (!row || typeof row !== "object") continue;
    const qid = typeof row.id === "string" ? row.id : null;
    if (!qid || !validIds.has(qid)) continue;
    const answer = typeof row.answer === "string" ? row.answer.trim() : "";
    const points =
      typeof row.points === "number" && Number.isFinite(row.points)
        ? row.points
        : undefined;
    updates.push({ id: qid, answer, points });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.question.update({
        where: { id: u.id },
        data:
          u.points !== undefined
            ? { answer: u.answer, points: u.points }
            : { answer: u.answer },
      })
    )
  );

  return NextResponse.json({ updated: updates.length });
}
