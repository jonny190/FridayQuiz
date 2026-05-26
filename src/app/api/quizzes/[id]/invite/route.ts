import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";
import { sendQuizInvitationEmail } from "@/lib/email";
import { generateRandomToken } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const MAGIC_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Send a play invitation email to every active team's contact for this
// quiz. Each email has a magic-link that signs the contact in and lands
// them on /dashboard/play/[quizId]?teamId=[teamId].
//
// Body (optional): { includeMembers?: boolean }
//   - false (default): only team contacts
//   - true: contacts plus all TeamMembers
export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const includeMembers = body?.includeMembers === true;

  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const activeTeams = await prisma.team.findMany({
    where: { isActive: true },
    include: includeMembers
      ? {
          members: {
            select: {
              user: { select: { id: true, email: true } },
            },
          },
        }
      : undefined,
  });

  if (activeTeams.length === 0) {
    return NextResponse.json({
      invited: 0,
      emailsSent: 0,
      emailsFailed: 0,
      message: "No active teams to invite",
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const expiry = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);

  type Job = { email: string; teamName: string; teamId: string };
  const jobs: Job[] = [];
  const seen = new Set<string>();

  for (const team of activeTeams) {
    const contact = team.contactEmail?.toLowerCase();
    if (contact && !seen.has(`${team.id}::${contact}`)) {
      seen.add(`${team.id}::${contact}`);
      jobs.push({ email: contact, teamName: team.name, teamId: team.id });

      // Self-heal: make sure the contact is an OWNER TeamMember of the
      // team so that they can actually load /api/play/[id]?teamId=…
      // when they click the magic link. Teams created before the
      // auto-upsert logic landed don't have this row.
      try {
        const contactUser = await prisma.user.upsert({
          where: { email: contact },
          update: {},
          create: { email: contact, role: "MEMBER" },
        });
        await prisma.teamMember.upsert({
          where: {
            userId_teamId: { userId: contactUser.id, teamId: team.id },
          },
          update: { role: "OWNER" },
          create: {
            userId: contactUser.id,
            teamId: team.id,
            role: "OWNER",
          },
        });
      } catch (err) {
        console.error(
          `[invite] could not ensure TeamMember for ${contact} on team ${team.id}: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    if (includeMembers && "members" in team) {
      const t = team as typeof team & {
        members: { user: { id: string; email: string } }[];
      };
      for (const m of t.members) {
        const e = m.user.email?.toLowerCase();
        if (e && !seen.has(`${team.id}::${e}`)) {
          seen.add(`${team.id}::${e}`);
          jobs.push({ email: e, teamName: team.name, teamId: team.id });
        }
      }
    }
  }

  console.log(
    `[invite] quiz=${quiz.number} activeTeams=${activeTeams.length} jobs=${jobs.length} includeMembers=${includeMembers}`
  );

  // Mint tokens — one per recipient, per team. Note: a single user
  // can only hold one valid magicToken at a time (schema constraint),
  // so if the same email contacts two teams, the second mint wins and
  // the first link goes dead. Acceptable for now; flag if it bites.
  const tokenByEmail = new Map<string, string>();
  for (const job of jobs) {
    try {
      const user = await prisma.user.upsert({
        where: { email: job.email },
        update: {},
        create: { email: job.email, role: "MEMBER" },
      });
      const token = generateRandomToken(48);
      await prisma.user.update({
        where: { id: user.id },
        data: { magicToken: token, magicTokenExpiry: expiry },
      });
      tokenByEmail.set(job.email, token);
    } catch (err) {
      console.error(
        `[invite] could not mint magic token for ${job.email}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  const results = await Promise.allSettled(
    jobs.map((job) => {
      const token = tokenByEmail.get(job.email);
      if (!token) {
        return Promise.resolve({ success: false, error: "no token" } as const);
      }
      const next = encodeURIComponent(
        `/dashboard/play/${quiz.id}?teamId=${job.teamId}`
      );
      const signInUrl = `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}&next=${next}`;
      return sendQuizInvitationEmail(job.email, {
        quizNumber: quiz.number,
        quizTitle: quiz.title,
        teamName: job.teamName,
        signInUrl,
      });
    })
  );

  let emailsSent = 0;
  let emailsFailed = 0;
  results.forEach((r, idx) => {
    const job = jobs[idx];
    if (r.status === "fulfilled" && r.value.success) {
      emailsSent += 1;
      console.log(
        `[invite] ok team=${JSON.stringify(job.teamName)} to=${job.email}`
      );
    } else {
      emailsFailed += 1;
      const reason =
        r.status === "rejected"
          ? r.reason instanceof Error
            ? `${r.reason.name}: ${r.reason.message}`
            : String(r.reason)
          : r.value && "error" in r.value
            ? r.value.error instanceof Error
              ? `${r.value.error.name}: ${r.value.error.message}`
              : JSON.stringify(r.value.error)
            : "unknown";
      console.error(
        `[invite] fail team=${JSON.stringify(job.teamName)} to=${job.email} reason=${reason}`
      );
    }
  });

  console.log(
    `[invite] quiz=${quiz.number} done sent=${emailsSent} failed=${emailsFailed}`
  );

  return NextResponse.json({
    invited: jobs.length,
    emailsSent,
    emailsFailed,
  });
}
