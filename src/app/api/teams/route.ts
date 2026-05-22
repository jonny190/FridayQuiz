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

function parseMemberEmails(input: unknown): string[] {
  let lines: string[];
  if (Array.isArray(input)) {
    lines = input.filter((v): v is string => typeof v === "string");
  } else if (typeof input === "string") {
    lines = input.split(/[\n,]/);
  } else {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
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
    const memberEmails = parseMemberEmails(body?.members);

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
    });

    if (memberEmails.length > 0) {
      // Upsert users and create TeamMember rows.
      for (const email of memberEmails) {
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, role: "MEMBER" },
        });
        await prisma.teamMember.upsert({
          where: { userId_teamId: { userId: user.id, teamId: team.id } },
          update: {},
          create: { userId: user.id, teamId: team.id },
        });
      }
    }

    const result = await prisma.team.findUnique({
      where: { id: team.id },
      include: { _count: { select: { members: true } } },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
