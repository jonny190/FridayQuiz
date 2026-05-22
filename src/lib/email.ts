import nodemailer from "nodemailer";

// Create nodemailer transport using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

// Verify SMTP connection
transporter.verify((error: Error | null, success: boolean) => {
  if (error) {
    console.error("Brevo SMTP connection error:", error);
  } else {
    console.log("Brevo SMTP is connected and ready");
  }
});

export async function sendMagicLinkEmail(email: string, token: string) {
  const signInUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/verify?token=${encodeURIComponent(token)}`;
  const fromAddress = process.env.EMAIL_FROM || "noreply@daveys.xyz";

  try {
    const info = await transporter.sendMail({
      from: `"Friday Quiz" <${fromAddress}>`,
      to: email,
      subject: "Friday Quiz - Sign In Link",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Friday Quiz</h1>
          <p>Hello,</p>
          <p>Someone requested a sign-in link for Friday Quiz.</p>
          <p>Click the button below to sign in:</p>
          <p style="margin: 24px 0;">
            <a href="${signInUrl}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Sign In
            </a>
          </p>
          <p>If you didn't request this link, you can safely ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">
            Friday Quiz Management Platform
          </p>
        </div>
      `,
    });

    console.log("Magic link email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending magic link email:", error);
    return { success: false, error };
  }
}

export async function sendQuizResultsEmail(
  email: string,
  quizNumber: number,
  results: { teamName: string; score: number; total: number; percentage: number; rank: number }[],
  options?: { signInUrl?: string }
) {
  const fromAddress = process.env.EMAIL_FROM || "noreply@daveys.xyz";
  const dashboardUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const linkUrl = options?.signInUrl ?? `${dashboardUrl}/dashboard/results`;
  const linkLabel = options?.signInUrl
    ? results.length > 0
      ? "Sign in & view results"
      : "Sign in to dashboard"
    : results.length > 0
      ? "View Results"
      : "Open Dashboard";

  const sortedResults = [...results].sort((a, b) => a.rank - b.rank);
  const hasResults = sortedResults.length > 0;

  const leaderboardHtml = hasResults
    ? `
        <div style="margin: 24px 0; background: #f9f9f9; padding: 16px; border-radius: 8px;">
          <h2 style="color: #333; margin-top: 0;">Leaderboard</h2>
          ${sortedResults
            .map(
              (r, i) => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
              <span>${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${r.rank}.`}</span>
              <strong>${r.teamName}</strong>
              <span>${r.score}/${r.total} (${r.percentage}%)</span>
            </div>
          `
            )
            .join("")}
        </div>`
    : `
        <div style="margin: 24px 0; padding: 16px; border-radius: 8px; background: #f9f9f9; color: #555;">
          Quiz ${quizNumber} is now live. Scores haven't been entered
          yet — check back once the quizmaster has finished marking.
        </div>`;

  try {
    const info = await transporter.sendMail({
      from: `"Friday Quiz" <${fromAddress}>`,
      to: email,
      subject: hasResults
        ? `Quiz ${quizNumber} — Results Published!`
        : `Quiz ${quizNumber} — Published`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Quiz ${quizNumber}</h1>
          <p>Hello,</p>
          <p>${hasResults ? `The results for Quiz ${quizNumber} have been published!` : `Quiz ${quizNumber} is now published.`}</p>

          ${leaderboardHtml}

          <p>${options?.signInUrl ? "Click the button below to sign in and view the dashboard — no password needed." : `Log in to see the full details${hasResults ? " and individual question results" : ""}.`}</p>
          <p style="margin: 24px 0;">
            <a href="${linkUrl}"
               style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              ${linkLabel}
            </a>
          </p>
          ${options?.signInUrl ? `<p style="color:#888;font-size:12px;">This sign-in link is single-use and expires in 24 hours.</p>` : ""}
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">
            Friday Quiz Management Platform
          </p>
        </div>
      `,
    });

    console.log(
      `[email] results to=${email} quiz=${quizNumber} messageId=${info.messageId} accepted=${(info.accepted ?? []).join(",")} rejected=${(info.rejected ?? []).join(",")}`
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : JSON.stringify(error);
    console.error(`[email] FAILED to=${email} quiz=${quizNumber} error=${detail}`);
    return { success: false, error };
  }
}