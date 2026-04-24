import { NextResponse } from "next/server";

/**
 * Auth0 federated logout.
 * Clears the Auth0 session by redirecting to Auth0's /v2/logout endpoint,
 * then sends the user back to our sign-in page.
 */
export async function GET() {
  const domain   = process.env.AUTH0_DOMAIN || process.env.AUTH_AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID || process.env.AUTH_AUTH0_ID;
  const baseUrl  = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://qms-app-two.vercel.app";

  if (!domain || !clientId) {
    return NextResponse.redirect(new URL("/auth/signin", baseUrl));
  }

  const returnTo = `${baseUrl}/auth/signin`;
  const logoutUrl = `https://${domain}/v2/logout?client_id=${encodeURIComponent(clientId)}&returnTo=${encodeURIComponent(returnTo)}`;

  return NextResponse.redirect(logoutUrl);
}
