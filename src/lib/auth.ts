import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable:              users,
    accountsTable:           accounts,
    sessionsTable:           sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error:  "/auth/error",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email    = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        if (user.status !== "active") {
          throw new Error("Account is not active. Please contact an administrator.");
        }

        logger.info("User signed in via credentials", { userId: user.id });

        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          image: user.image,
          role:  user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id   = user.id!;
        token.role = ((user as Record<string, unknown>).role as string) ?? "user";
      }

      if (trigger === "update" && session) {
        if (session.name)  token.name    = session.name;
        if (session.role)  token.role    = session.role;
        if (session.image) token.picture = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
