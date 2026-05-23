import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

async function getMembership(userId: string, quizId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { userId }, select: { id: true, role: true } },
    },
  });
  if (!team || !team.isActive) return null;
  const member = team.members[0];
  if (!member) return null;
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return null;
  return { team, member, quiz };
}

// GET the quiz to play. Returns questions (with images, NO correct
// answer), and the team's existing draft / submitted answers.
export async function GET(request: NextRequest, { params }: Params) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }

  const context = await getMembership(guard.user.id, id, teamId);
  if (!context) {
    return NextResponse.json({ error: "Not on this team" }, { status: 403 });
  }

  const questions = await prisma.question.findMany({
    where: { quizId: id },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      text: true,
      imageUrls: true,
      isImageBased: true,
      points: true,
    },
  });

  const answers = await prisma.quizAnswer.findMany({
    where: { quizId: id, teamId },
    select: {
      questionId: true,
      answer: true,
      isDraft: true,
      points: true,
    },
  });

  const submitted = answers.length > 0 && answers.every((a) => !a.isDraft);

  return NextResponse.json({
    quiz: {
      id: context.quiz.id,
      number: context.quiz.number,
      title: context.quiz.title,
      status: context.quiz.status,
    },
    team: { id: context.team.id, name: context.team.name },
    isOwner: context.member.role === "OWNER",
    submitted,
    questions,
    answers,
  });
}

// PUT updates the team's draft answers. Body:
//   { teamId, answers: [{ questionId, answer }] }
// Refuses if the team has already submitted.
export async function PUT(request: NextRequest, { params }: Params) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const teamId = typeof body?.teamId === "string" ? body.teamId : null;
  const entries = Array.isArray(body?.answers) ? body.answers : null;
  if (!teamId || !entries) {
    return NextResponse.json(
      { error: "teamId and answers required" },
      { status: 400 }
    );
  }

  const context = await getMembership(guard.user.id, id, teamId);
  if (!context) {
    return NextResponse.json({ error: "Not on this team" }, { status: 403 });
  }
  if (context.quiz.status !== "ACTIVE") {
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
      { error: "This team has already locked in their answers" },
      { status: 400 }
    );
  }

  const validQuestionIds = new Set(
    (
      await prisma.question.findMany({
        where: { quizId: id },
        select: { id: true },
      })
    ).map((q) => q.id)
  );

  const ops = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const questionId =
      typeof raw.questionId === "string" ? raw.questionId : null;
    if (!questionId || !validQuestionIds.has(questionId)) continue;
    const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";

    if (!answer) {
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
          isDraft: true,
          submittedById: guard.user.id,
        },
        update: { answer, isDraft: true, submittedById: guard.user.id },
      })
    );
  }

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
