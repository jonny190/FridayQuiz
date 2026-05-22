import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseQuizDocx } from "@/lib/quizParser";
import { requireQuizmaster, requireUser } from "@/lib/sessionGuards";

// GET - List all quizzes
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { number: "desc" },
      include: {
        _count: { select: { questions: true } },
      },
    });
    return NextResponse.json(quizzes);
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}

// POST - Create a new quiz (with optional DOCX upload)
export async function POST(request: NextRequest) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  try {
    const formData = await request.formData();
    const quizNumberRaw = formData.get("quizNumber");
    const quizTitle = (formData.get("quizTitle") as string) || null;
    const file = formData.get("file") as File | null;
    const manualQuestions = formData.get("manualQuestions") as string | null;

    const quizNumber =
      typeof quizNumberRaw === "string" ? parseInt(quizNumberRaw, 10) : NaN;
    if (!Number.isFinite(quizNumber)) {
      return NextResponse.json(
        { error: "Quiz number is required" },
        { status: 400 }
      );
    }

    const existingQuiz = await prisma.quiz.findUnique({
      where: { number: quizNumber },
    });
    if (existingQuiz) {
      return NextResponse.json(
        { error: "Quiz number already exists" },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        number: quizNumber,
        title: quizTitle,
        status: "DRAFT",
        uploadedBy: guard.user.id,
      },
    });

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseQuizDocx(buffer);

      if (parsed.questions.length > 0) {
        await prisma.question.createMany({
          data: parsed.questions.map((q, index) => ({
            quizId: quiz.id,
            order: index + 1,
            type: q.imageUrls.length > 0 ? "IMAGE" : "TEXT",
            text: q.question,
            answer: q.answer,
            points: q.points,
            imageUrls: q.imageUrls,
            isImageBased: q.imageUrls.length > 0,
          })),
        });
      }
    }

    if (manualQuestions) {
      const questions = JSON.parse(manualQuestions) as string[];
      await prisma.question.createMany({
        data: questions
          .filter((q) => q.trim())
          .map((q, index) => ({
            quizId: quiz.id,
            order: index + 1,
            type: "TEXT",
            text: q.trim(),
            answer: "",
            points: 1,
          })),
      });
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error creating quiz:", error);
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 }
    );
  }
}
