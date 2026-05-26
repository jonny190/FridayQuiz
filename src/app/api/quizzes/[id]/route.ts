import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseQuizDocx } from "@/lib/quizParser";
import { requireQuizmaster } from "@/lib/sessionGuards";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { questions: true } },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  return NextResponse.json(quiz);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await prisma.$transaction([
      prisma.suggestion.deleteMany({ where: { quizId: id } }),
      prisma.quizAnswer.deleteMany({ where: { quizId: id } }),
      prisma.quizResult.deleteMany({ where: { quizId: id } }),
      prisma.question.deleteMany({ where: { quizId: id } }),
      prisma.quiz.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}

// PATCH: re-upload DOCX (replaces all questions) and/or update title/status.
export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const title = formData.get("quizTitle");

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parseQuizDocx(buffer);

        await prisma.$transaction([
          prisma.suggestion.deleteMany({ where: { quizId: id } }),
          prisma.quizAnswer.deleteMany({ where: { quizId: id } }),
          prisma.question.deleteMany({ where: { quizId: id } }),
          prisma.question.createMany({
            data: parsed.questions.map((q, index) => ({
              quizId: id,
              order: index + 1,
              type: q.imageUrls.length > 0 ? "IMAGE" : "TEXT",
              text: q.question,
              answer: q.answer,
              points: q.points,
              imageUrls: q.imageUrls,
              isImageBased: q.imageUrls.length > 0,
            })),
          }),
          ...(typeof title === "string"
            ? [
                prisma.quiz.update({
                  where: { id },
                  data: { title: title.trim() || null },
                }),
              ]
            : []),
        ]);
      } else if (typeof title === "string") {
        await prisma.quiz.update({
          where: { id },
          data: { title: title.trim() || null },
        });
      }
    } else {
      const body = await request.json();
      const data: { title?: string | null; status?: string } = {};
      if (typeof body?.title === "string") data.title = body.title.trim() || null;
      if (typeof body?.status === "string") data.status = body.status;
      await prisma.quiz.update({ where: { id }, data: data as never });
    }

    const updated = await prisma.quiz.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}
