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
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            magicToken,
            magicTokenExpiry: { gt: new Date() },
          },
        });

        if (!user) {
          return null;
        }

        // Atomically consume the token — single-use. If another
        // request already consumed it, this update affects 0 rows.
        const consumed = await prisma.user.updateMany({
          where: { id: user.id, magicToken },
          data: { magicToken: null, magicTokenExpiry: null },
        });

        if (consumed.count === 0) {
          return null;
        }

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
    signOut: "/auth/signout",
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
