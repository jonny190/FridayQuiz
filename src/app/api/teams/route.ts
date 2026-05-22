import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster, requireUser } from "@/lib/sessionGuards";

// GET - List all teams
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  try {
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true } },
      },
    });
    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

// POST - Create a new team
export async function POST(request: NextRequest) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const contactEmail =
      typeof body?.contactEmail === "string" ? body.contactEmail.trim() : "";

    if (!name || !contactEmail) {
      return NextResponse.json(
        { error: "Team name and contact email are required" },
        { status: 400 }
      );
    }

    const existingTeam = await prisma.team.findFirst({
      where: { name: { mode: "insensitive", equals: name } },
    });
    if (existingTeam) {
      return NextResponse.json(
        { error: "Team name already exists" },
        { status: 400 }
      );
    }

    const team = await prisma.team.create({
      data: { name, contactEmail },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
