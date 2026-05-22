import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

// GET returns everything needed to drive the marking UI: the quiz, its
// questions (with correct answers), all teams, and any QuizAnswer rows
// already saved.
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const [teams, quizAnswers] = await prisma.$transaction([
    prisma.team.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.quizAnswer.findMany({
      where: { quizId: id },
      select: {
        id: true,
        questionId: true,
        teamId: true,
        answer: true,
        points: true,
      },
    }),
  ]);

  return NextResponse.json({ quiz, teams, answers: quizAnswers });
}

// PUT upserts team answers for ONE question. Body:
//   { questionId, entries: [{ teamId, answer, points }] }
// answer is the team's submitted answer; points is what the quizmaster
// awarded for it.
export async function PUT(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const questionId = typeof body?.questionId === "string" ? body.questionId : null;
  const entries = Array.isArray(body?.entries) ? body.entries : null;
  if (!questionId || !entries) {
    return NextResponse.json(
      { error: "questionId and entries array required" },
      { status: 400 }
    );
  }

  const question = await prisma.question.findFirst({
    where: { id: questionId, quizId: id },
    select: { id: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not in this quiz" }, { status: 404 });
  }

  // Validate team IDs.
  const teamIds = entries
    .map((e: unknown) =>
      e && typeof e === "object" && typeof (e as { teamId?: unknown }).teamId === "string"
        ? (e as { teamId: string }).teamId
        : null
    )
    .filter((v: string | null): v is string => v !== null);
  const validTeams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true },
  });
  const validTeamIds = new Set(validTeams.map((t) => t.id));

  const ops = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as { teamId?: unknown; answer?: unknown; points?: unknown };
    const teamId = typeof e.teamId === "string" ? e.teamId : null;
    if (!teamId || !validTeamIds.has(teamId)) continue;

    const answer = typeof e.answer === "string" ? e.answer.trim() : "";
    const points =
      typeof e.points === "number" && Number.isFinite(e.points) ? e.points : null;

    // Empty answer + null points => delete the row if it exists.
    if (!answer && points === null) {
      ops.push(
        prisma.quizAnswer.deleteMany({
          where: { quizId: id, questionId, teamId },
        })
      );
      continue;
    }

    ops.push(
      prisma.quizAnswer.upsert({
        where: {
          quizId_questionId_teamId: { quizId: id, questionId, teamId },
        },
        create: {
          quizId: id,
          questionId,
          teamId,
          answer,
          points,
        },
        update: { answer, points },
      })
    );
  }

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
