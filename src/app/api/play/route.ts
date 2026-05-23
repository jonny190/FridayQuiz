import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/sessionGuards";

// List quizzes the signed-in user can play for each of their teams.
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const memberships = await prisma.teamMember.findMany({
    where: { userId: guard.user.id, team: { isActive: true } },
    select: {
      role: true,
      team: { select: { id: true, name: true, contactEmail: true } },
    },
  });

  if (memberships.length === 0) return NextResponse.json([]);

  const quizzes = await prisma.quiz.findMany({
    where: { status: "ACTIVE" },
    orderBy: { number: "desc" },
    select: { id: true, number: true, title: true, date: true },
  });
  if (quizzes.length === 0) return NextResponse.json([]);

  const teamIds = memberships.map((m) => m.team.id);
  const quizIds = quizzes.map((q) => q.id);

  // Determine submission state per (quiz, team).
  const answerRows = await prisma.quizAnswer.findMany({
    where: { quizId: { in: quizIds }, teamId: { in: teamIds } },
    select: { quizId: true, teamId: true, isDraft: true },
  });

  const stateKey = (qid: string, tid: string) => `${qid}::${tid}`;
  type State = "not_started" | "draft" | "submitted";
  const stateMap = new Map<string, State>();
  for (const row of answerRows) {
    const k = stateKey(row.quizId, row.teamId);
    const current = stateMap.get(k);
    if (!row.isDraft) {
      stateMap.set(k, "submitted");
    } else if (current !== "submitted") {
      stateMap.set(k, "draft");
    }
  }

  const items = [];
  for (const quiz of quizzes) {
    for (const m of memberships) {
      const state =
        stateMap.get(stateKey(quiz.id, m.team.id)) ?? ("not_started" as State);
      items.push({
        quizId: quiz.id,
        quizNumber: quiz.number,
        quizTitle: quiz.title,
        quizDate: quiz.date,
        teamId: m.team.id,
        teamName: m.team.name,
        isOwner: m.role === "OWNER",
        state,
      });
    }
  }

  return NextResponse.json(items);
}
