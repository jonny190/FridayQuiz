import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/sessionGuards";

export async function GET(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const quizId = request.nextUrl.searchParams.get("quizId");

  try {
    const results = await prisma.quizResult.findMany({
      where: quizId ? { quizId } : undefined,
      orderBy: [{ quiz: { number: "desc" } }, { rank: "asc" }, { totalScore: "desc" }],
      include: {
        quiz: { select: { id: true, number: true, title: true, status: true } },
        team: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
