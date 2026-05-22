import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Magic Link",
      credentials: {
        magicToken: { label: "Magic Token", type: "text" },
      },
      async authorize(credentials) {
        const magicToken = credentials?.magicToken;
        if (typeof magicToken !== "string" || magicToken.length === 0) {
          console.warn("[auth] authorize called without magicToken");
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            magicToken,
            magicTokenExpiry: { gt: new Date() },
          },
        });

        if (!user) {
          // Tell the operator whether the token is unknown vs expired
          // vs already consumed (no row matched on magicToken either way).
          const stale = await prisma.user.findFirst({
            where: { magicToken },
            select: { id: true, magicTokenExpiry: true },
          });
          if (stale) {
            console.warn(
              `[auth] token expired for user=${stale.id} expiry=${stale.magicTokenExpiry?.toISOString()}`
            );
          } else {
            console.warn(
              `[auth] no matching token (already consumed or never existed): ${magicToken.slice(0, 6)}…`
            );
          }
          return null;
        }

        // Atomically consume the token — single-use. If another
        // request already consumed it, this update affects 0 rows.
        const consumed = await prisma.user.updateMany({
          where: { id: user.id, magicToken },
          data: { magicToken: null, magicTokenExpiry: null },
        });

        if (consumed.count === 0) {
          console.warn(
            `[auth] token consumption race for user=${user.id} — already used`
          );
          return null;
        }

        console.log(`[auth] sign-in via magic token for user=${user.id}`);

        const quizmasterEmail = process.env.QUIZMASTER_EMAIL?.toLowerCase();
        if (
          quizmasterEmail &&
          quizmasterEmail === user.email.toLowerCase() &&
          user.role !== "QUIZMASTER"
        ) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "QUIZMASTER" },
          });
          user.role = "QUIZMASTER";
        }

        return {
          id: user.id,
          email: user.email,
          name:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
