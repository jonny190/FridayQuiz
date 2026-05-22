import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQuizmaster } from "@/lib/sessionGuards";
import { sendQuizResultsEmail } from "@/lib/email";
import { generateRandomToken } from "@/lib/utils";

const MAGIC_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireQuizmaster();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const includeMembers = body?.includeMembers === true;
  const sendEmails = body?.sendEmails !== false; // default true

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { select: { points: true } },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0);

  // Compute per-team totals from QuizAnswer rows.
  const answers = await prisma.quizAnswer.findMany({
    where: { quizId: id },
    select: { teamId: true, points: true },
  });

  const totals = new Map<string, number>();
  for (const a of answers) {
    totals.set(a.teamId, (totals.get(a.teamId) ?? 0) + (a.points ?? 0));
  }

  const ranked = Array.from(totals.entries())
    .map(([teamId, totalScore]) => ({ teamId, totalScore }))
    .sort((a, b) => b.totalScore - a.totalScore);

  let lastScore: number | null = null;
  let lastRank = 0;
  const withRanks = ranked.map((row, index) => {
    if (lastScore === null || row.totalScore < lastScore) {
      lastRank = index + 1;
      lastScore = row.totalScore;
    }
    return { ...row, rank: lastRank };
  });

  const now = new Date();

  await prisma.$transaction([
    prisma.quizResult.deleteMany({ where: { quizId: id } }),
    ...withRanks.map((r) =>
      prisma.quizResult.create({
        data: {
          quizId: id,
          teamId: r.teamId,
          totalScore: r.totalScore,
          rank: r.rank,
          published: true,
          publishedAt: now,
        },
      })
    ),
    prisma.quiz.update({ where: { id }, data: { status: "PUBLISHED" } }),
  ]);

  if (!sendEmails) {
    console.log(
      `[publish] quiz=${quiz.number} published=${withRanks.length} emails=skipped`
    );
    return NextResponse.json({
      published: withRanks.length,
      emailsSent: 0,
      emailsFailed: 0,
    });
  }

  // Build leaderboard from any teams that had QuizAnswers.
  const scoredTeamIds = withRanks.map((r) => r.teamId);
  const scoredTeams = await prisma.team.findMany({
    where: { id: { in: scoredTeamIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(scoredTeams.map((t) => [t.id, t.name]));

  const leaderboard = withRanks.map((r) => ({
    teamName: nameById.get(r.teamId) ?? "Unknown",
    score: r.totalScore,
    total: maxScore,
    percentage:
      maxScore > 0 ? Math.round((r.totalScore / maxScore) * 100) : 0,
    rank: r.rank,
  }));

  // Recipients: every active team's contact, plus members when opted in.
  // Sending to all active teams (not just scored ones) so teams hear about
  // a published quiz even when no marks were entered.
  const allActiveTeams = await prisma.team.findMany({
    where: { isActive: true },
    include: includeMembers
      ? {
          members: {
            select: { user: { select: { email: true } } },
          },
        }
      : undefined,
  });

  // Build a per-recipient record so we can log who got what.
  type Recipient = { email: string; teamName: string; via: "contact" | "member" };
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const team of allActiveTeams) {
    const contact = team.contactEmail?.toLowerCase();
    if (contact && !seen.has(contact)) {
      seen.add(contact);
      recipients.push({ email: contact, teamName: team.name, via: "contact" });
    }
    if (includeMembers && "members" in team) {
      const t = team as typeof team & {
        members: { user: { email: string } }[];
      };
      for (const m of t.members) {
        const e = m.user.email?.toLowerCase();
        if (e && !seen.has(e)) {
          seen.add(e);
          recipients.push({ email: e, teamName: team.name, via: "member" });
        }
      }
    }
  }

  console.log(
    `[publish] quiz=${quiz.number} activeTeams=${allActiveTeams.length} scoredTeams=${withRanks.length} recipients=${recipients.length} includeMembers=${includeMembers}`
  );
  if (recipients.length === 0) {
    console.warn(
      `[publish] quiz=${quiz.number} no recipients — check that at least one team is active and has a contactEmail`
    );
  }

  // For each recipient, upsert a user record and mint a single-use
  // magic token so the "View Results" button signs them straight in.
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const expiry = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);
  const tokenByEmail = new Map<string, string>();

  for (const r of recipients) {
    try {
      const user = await prisma.user.upsert({
        where: { email: r.email },
        update: {},
        create: { email: r.email, role: "MEMBER" },
      });
      const token = generateRandomToken(48);
      await prisma.user.update({
        where: { id: user.id },
        data: { magicToken: token, magicTokenExpiry: expiry },
      });
      tokenByEmail.set(r.email, token);
    } catch (err) {
      console.error(
        `[publish] could not mint magic token for ${r.email}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  const next = encodeURIComponent("/dashboard/results");
  const results = await Promise.allSettled(
    recipients.map((r) => {
      const token = tokenByEmail.get(r.email);
      const signInUrl = token
        ? `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}&next=${next}`
        : undefined;
      return sendQuizResultsEmail(r.email, quiz.number, leaderboard, { signInUrl });
    })
  );

  let emailsSent = 0;
  let emailsFailed = 0;
  results.forEach((r, idx) => {
    const recipient = recipients[idx];
    if (r.status === "fulfilled" && r.value.success) {
      emailsSent += 1;
      console.log(
        `[publish] ok team=${JSON.stringify(recipient.teamName)} via=${recipient.via} to=${recipient.email}`
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
        `[publish] fail team=${JSON.stringify(recipient.teamName)} via=${recipient.via} to=${recipient.email} reason=${reason}`
      );
    }
  });

  console.log(
    `[publish] quiz=${quiz.number} done sent=${emailsSent} failed=${emailsFailed}`
  );

  return NextResponse.json({
    published: withRanks.length,
    emailsSent,
    emailsFailed,
    recipients: recipients.length,
  });
}
