/**
 * Customer-portal authentication (Plan §6.5 / §13).
 *
 * A SEPARATE identity plane from staff `users`/NextAuth. A portal contact
 * authenticates only into `/portal`; its session is a signed JWT in an
 * httpOnly cookie carrying { contactId, customerId, workspaceId }. Portal
 * routes resolve this and filter every query by customerId + workspaceId.
 * Portal sessions can never satisfy the staff `auth()` guard, and vice-versa.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const PORTAL_COOKIE = "portal_session";
const ISSUER = "qms-portal";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const raw = process.env.AUTH_SECRET ?? "dev-insecure-portal-secret-change-me";
  // Namespace the portal key so a portal token can never be a staff token.
  return new TextEncoder().encode(`portal:${raw}`);
}

export interface PortalSession {
  contactId: string;
  customerId: string;
  workspaceId: string;
}

export async function hashPortalPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPortalPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Sign a portal session and set the httpOnly cookie. */
export async function setPortalSession(session: PortalSession): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/** Read and verify the portal session from the request cookie, or null. */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    if (!payload.contactId || !payload.customerId || !payload.workspaceId) return null;
    return {
      contactId: payload.contactId as string,
      customerId: payload.customerId as string,
      workspaceId: payload.workspaceId as string,
    };
  } catch {
    return null;
  }
}

/** Clear the portal session cookie. */
export async function clearPortalSession(): Promise<void> {
  const store = await cookies();
  store.delete(PORTAL_COOKIE);
}
