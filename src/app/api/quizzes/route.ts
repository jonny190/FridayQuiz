import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuizDocx } from "@/lib/quizParser";

// GET - List all quizzes
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quizzes = await prisma.quiz.findMany({
      orderBy: {
        number: "desc",
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const quizNumber = formData.get("quizNumber") as string;
    const quizTitle = (formData.get("quizTitle") as string) || null;
    const file = formData.get("file") as File | null;
    const manualQuestions = formData.get("manualQuestions") as string | null;

    if (!quizNumber) {
      return NextResponse.json(
        { error: "Quiz number is required" },
        { status: 400 }
      );
    }

    // Check if quiz number already exists
    const existingQuiz = await prisma.quiz.findUnique({
      where: { number: parseInt(quizNumber, 10) },
    });

    if (existingQuiz) {
      return NextResponse.json(
        { error: "Quiz number already exists" },
        { status: 400 }
      );
    }

    // Create the quiz with uploadedBy
    const quiz = await prisma.quiz.create({
      data: {
        number: parseInt(quizNumber, 10),
        title: quizTitle,
        status: "DRAFT",
        uploadedBy: (session.user as any).id,
      },
    });

    // Process DOCX file if provided
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseQuizDocx(buffer);

      if (parsed.questions.length > 0) {
        await prisma.question.createMany({
          data: parsed.questions.map((q, index) => ({
            quizId: quiz.id,
            number: q.number,
            order: index + 1,
            type: "TEXT",
            text: q.question,
            answer: q.answer,
            points: q.points,
          })),
        });
      }
    }

    // Process manual questions if provided
    if (manualQuestions) {
      const questions = JSON.parse(manualQuestions) as string[];
      await prisma.question.createMany({
        data: questions
          .filter((q) => q.trim())
          .map((q, index) => ({
            quizId: quiz.id,
            number: index + 1,
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