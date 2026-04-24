import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Auth0 from "next-auth/providers/auth0";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";

const auth0Domain   = process.env.AUTH0_DOMAIN        || process.env.AUTH_AUTH0_DOMAIN;
const auth0ClientId = process.env.AUTH0_CLIENT_ID     || process.env.AUTH_AUTH0_ID;
const auth0Secret   = process.env.AUTH0_CLIENT_SECRET || process.env.AUTH_AUTH0_SECRET || "";

// Auth0 canonical issuer always ends with "/" — ensure trailing slash to match
// the `iss` claim in ID tokens and the OIDC discovery document.
const rawIssuer     = process.env.AUTH_AUTH0_ISSUER   || (auth0Domain ? `https://${auth0Domain}` : undefined);
const auth0Issuer   = rawIssuer ? rawIssuer.replace(/\/?$/, "/") : undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  logger: {
    error(err) {
      const e = err as unknown as { name?: string; message?: string; cause?: unknown; stack?: string };
      // Single-line JSON so Vercel runtime logs don't truncate
      console.error("NEXTAUTH_FULL_ERROR", JSON.stringify({
        name: e?.name,
        message: e?.message,
        cause: (() => {
          try { return JSON.parse(JSON.stringify(e?.cause, Object.getOwnPropertyNames(e?.cause ?? {}))); } catch { return String(e?.cause); }
        })(),
        stack: e?.stack?.slice(0, 800),
      }));
    },
    warn(code) { console.warn("NEXTAUTH_WARN", String(code)); },
    debug(code, metadata) {
      try { console.log("NEXTAUTH_DEBUG", String(code), JSON.stringify(metadata)?.slice(0, 300)); } catch { console.log("NEXTAUTH_DEBUG", String(code)); }
    },
  },
  adapter: DrizzleAdapter(db, {
    usersTable:              users,
    accountsTable:           accounts,
    sessionsTable:           sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn:        "/auth/signin",
    error:         "/auth/error",
    verifyRequest: "/auth/verify-request",
  },
  providers: [
    // ── Email + Password ─────────────────────────────────────────────
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

    // ── Magic link (Resend) ──────────────────────────────────────────
    ...(process.env.AUTH_RESEND_KEY
      ? [Resend({ from: process.env.EMAIL_FROM || "QMS <noreply@yourdomain.com>" })]
      : []),

    // ── Google OAuth ─────────────────────────────────────────────────
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google({
          clientId:     process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          authorization: { params: { prompt: "consent", access_type: "offline" } },
        })]
      : []),

    // ── GitHub OAuth ─────────────────────────────────────────────────
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? [GitHub({
          clientId:     process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET,
        })]
      : []),

    // ── Auth0 ─────────────────────────────────────────────────────────
    ...(auth0ClientId && auth0Issuer
      ? [Auth0({ clientId: auth0ClientId, clientSecret: auth0Secret, issuer: auth0Issuer })]
      : []),
  ],

  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        console.log("NEXTAUTH_JWT_USER", JSON.stringify({ userId: user.id, email: user.email, provider: account?.provider }));
        token.id   = user.id!;
        token.role = ((user as Record<string, unknown>).role as string) ?? "user";
      }

      if (account?.provider && account.provider !== "credentials" && !token.role) {
        const [dbUser] = await db
          .select({ role: users.role, status: users.status })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);

        if (dbUser) token.role = dbUser.role as string;
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

    async signIn({ user, account }) {
      console.log("NEXTAUTH_SIGNIN_CB", JSON.stringify({ email: user.email, provider: account?.provider }));
      const oauthProviders = ["google", "github", "auth0", "resend"];
      if (account?.provider && oauthProviders.includes(account.provider)) {
        if (!user.email) return false;

        const [existing] = await db
          .select({ id: users.id, status: users.status })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (existing?.status === "pending") {
          await db
            .update(users)
            .set({ status: "active", emailVerified: new Date() })
            .where(eq(users.id, existing.id));

          logger.info("User auto-activated via OAuth", { userId: existing.id, provider: account.provider });
        }
      }
      return true;
    },
  },
});
