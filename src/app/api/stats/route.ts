import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/sessionGuards";

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const [totalQuizzes, activeQuizzes, totalTeams, publishedResults] =
    await prisma.$transaction([
      prisma.quiz.count(),
      prisma.quiz.count({ where: { status: "ACTIVE" } }),
      prisma.team.count(),
      prisma.quizResult.count({ where: { published: true } }),
    ]);

  return NextResponse.json({
    totalQuizzes,
    activeQuizzes,
    totalTeams,
    publishedResults,
  });
}
