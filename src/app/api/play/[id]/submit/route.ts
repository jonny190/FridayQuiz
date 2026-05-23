import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/sessionGuards";
import { autoScore } from "@/lib/autoScore";

type Params = { params: Promise<{ id: string }> };

// Lock in the team's answers. Only team OWNERs may lock. The route
// auto-scores each question using a case-insensitive whitespace-
// normalised comparison against Question.answer.
export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const teamId = typeof body?.teamId === "string" ? body.teamId : null;
  if (!teamId) {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { userId: guard.user.id }, select: { role: true } },
    },
  });
  const membership = team?.members[0];
  if (!team || !team.isActive || !membership) {
    return NextResponse.json({ error: "Not on this team" }, { status: 403 });
  }
  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the team owner can lock answers" },
      { status: 403 }
    );
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { select: { id: true, answer: true, points: true } },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  if (quiz.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Quiz is not currently open for submissions" },
      { status: 400 }
    );
  }

  const alreadySubmitted = await prisma.quizAnswer.findFirst({
    where: { quizId: id, teamId, isDraft: false },
    select: { id: true },
  });
  if (alreadySubmitted) {
    return NextResponse.json(
      { error: "Answers are already locked in" },
      { status: 400 }
    );
  }

  const drafts = await prisma.quizAnswer.findMany({
    where: { quizId: id, teamId, isDraft: true },
    select: { id: true, questionId: true, answer: true },
  });
  if (drafts.length === 0) {
    return NextResponse.json(
      { error: "No answers to submit. Save at least one answer first." },
      { status: 400 }
    );
  }

  const questionById = new Map(quiz.questions.map((q) => [q.id, q]));

  // Auto-score and flip isDraft=false.
  let totalScore = 0;
  await prisma.$transaction(
    drafts.map((d) => {
      const q = questionById.get(d.questionId);
      const points = q ? autoScore(d.answer, q.answer, q.points) : 0;
      totalScore += points;
      return prisma.quizAnswer.update({
        where: { id: d.id },
        data: { isDraft: false, points },
      });
    })
  );

  console.log(
    `[play] team=${team.name} submitted quiz=${quiz.number} answers=${drafts.length} autoScore=${totalScore}`
  );

  return NextResponse.json({
    locked: drafts.length,
    autoScore: totalScore,
    maxScore: quiz.questions.reduce((s, q) => s + q.points, 0),
  });
}
