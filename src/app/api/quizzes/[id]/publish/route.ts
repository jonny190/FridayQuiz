import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";
import { sendQuizResultsEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const includeMembers = body?.includeMembers === true;
  const sendEmails = body?.sendEmails !== false; // default true

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { select: { points: true } },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0);

  // Compute per-team totals from QuizAnswer rows.
  const answers = await prisma.quizAnswer.findMany({
    where: { quizId: id },
    select: { teamId: true, points: true },
  });

  const totals = new Map<string, number>();
  for (const a of answers) {
    totals.set(a.teamId, (totals.get(a.teamId) ?? 0) + (a.points ?? 0));
  }

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

  if (!sendEmails) {
    return NextResponse.json({
      published: withRanks.length,
      emailsSent: 0,
      emailsFailed: 0,
    });
  }

  // Gather recipients and build leaderboard payload.
  const teamIds = withRanks.map((r) => r.teamId);
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    include: includeMembers
      ? {
          members: {
            select: { user: { select: { email: true } } },
          },
        }
      : undefined,
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = withRanks.map((r) => {
    const team = teamById.get(r.teamId);
    return {
      teamName: team?.name ?? "Unknown",
      score: r.totalScore,
      total: maxScore,
      percentage:
        maxScore > 0 ? Math.round((r.totalScore / maxScore) * 100) : 0,
      rank: r.rank,
    };
  });

  const recipients = new Set<string>();
  for (const team of teams) {
    if (team.contactEmail) recipients.add(team.contactEmail.toLowerCase());
    if (includeMembers && "members" in team) {
      const t = team as typeof team & {
        members: { user: { email: string } }[];
      };
      for (const m of t.members) {
        if (m.user.email) recipients.add(m.user.email.toLowerCase());
      }
    }
  }

  const results = await Promise.allSettled(
    Array.from(recipients).map((email) =>
      sendQuizResultsEmail(email, quiz.number, leaderboard)
    )
  );

  let emailsSent = 0;
  let emailsFailed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.success) emailsSent += 1;
    else emailsFailed += 1;
  }

  return NextResponse.json({
    published: withRanks.length,
    emailsSent,
    emailsFailed,
  });
}
