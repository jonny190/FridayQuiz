import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { generateRandomToken } from "./utils";

export const authOptions: NextAuthOptions = {
  adapter: undefined as any, // We're using custom auth, not the default adapter
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        magicToken: { label: "Magic Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        const email = credentials.email as string;

        // Check if this is the configured quizmaster email
        const isQuizmaster = process.env.QUIZMASTER_EMAIL?.toLowerCase() === email.toLowerCase();

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Create new user if they don't exist
          // First user gets QUIZMASTER role, or if email matches QUIZMASTER_EMAIL
          const isFirstUser = await prisma.user.count() === 0;
          const role = isQuizmaster || isFirstUser ? "QUIZMASTER" : "MEMBER";
          
          const newUser = await prisma.user.create({
            data: {
              email,
              magicToken: generateRandomToken(),
              role,
            },
          });
          return {
            id: newUser.id,
            email: newUser.email,
            name: `${newUser.firstName || ""} ${newUser.lastName || ""}`.trim() || undefined,
            role: newUser.role,
          };
        }

        // If existing user matches QUIZMASTER_EMAIL, ensure they have QUIZMASTER role
        if (isQuizmaster && user.role !== "QUIZMASTER") {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "QUIZMASTER" },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined,
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