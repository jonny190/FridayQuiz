import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

// Compute QuizResult rows from all QuizAnswers on this quiz, rank teams
// by descending score, and mark them published. The quiz status is
// also set to PUBLISHED.
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  // Group answers by team and sum the awarded points (treating null as 0).
  const answers = await prisma.quizAnswer.findMany({
    where: { quizId: id },
    select: { teamId: true, points: true },
  });

  const totals = new Map<string, number>();
  for (const a of answers) {
    const prev = totals.get(a.teamId) ?? 0;
    totals.set(a.teamId, prev + (a.points ?? 0));
  }

  // Sort teams by score descending to assign ranks (ties share the
  // lower rank, e.g. 1, 2, 2, 4).
  const ranked = Array.from(totals.entries())
    .map(([teamId, totalScore]) => ({ teamId, totalScore }))
    .sort((a, b) => b.totalScore - a.totalScore);

  let lastScore: number | null = null;
  let lastRank = 0;
  const withRanks = ranked.map((row, index) => {
    if (lastScore === null || row.totalScore < lastScore) {
      lastRank = index + 1;
      lastScore = row.totalScore;
    }
    return { ...row, rank: lastRank };
  });

  const now = new Date();

  await prisma.$transaction([
    // Wipe out any previous result rows for this quiz so re-publishing
    // is idempotent.
    prisma.quizResult.deleteMany({ where: { quizId: id } }),
    ...withRanks.map((r) =>
      prisma.quizResult.create({
        data: {
          quizId: id,
          teamId: r.teamId,
          totalScore: r.totalScore,
          rank: r.rank,
          published: true,
          publishedAt: now,
        },
      })
    ),
    prisma.quiz.update({ where: { id }, data: { status: "PUBLISHED" } }),
  ]);

  return NextResponse.json({ published: withRanks.length });
}
