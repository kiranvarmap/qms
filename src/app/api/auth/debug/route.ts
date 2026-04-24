import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth0Domain   = process.env.AUTH0_DOMAIN        || process.env.AUTH_AUTH0_DOMAIN;
  const auth0ClientId = process.env.AUTH0_CLIENT_ID     || process.env.AUTH_AUTH0_ID;
  const auth0Secret   = process.env.AUTH0_CLIENT_SECRET || process.env.AUTH_AUTH0_SECRET;
  const rawIssuer     = process.env.AUTH_AUTH0_ISSUER   || (auth0Domain ? `https://${auth0Domain}` : undefined);
  const computedIssuer = rawIssuer ? rawIssuer.replace(/\/?$/, "/") : undefined;

  const checks: Record<string, unknown> = {
    AUTH_SECRET_set:        !!process.env.AUTH_SECRET,
    AUTH_SECRET_length:     process.env.AUTH_SECRET?.length ?? 0,
    NEXTAUTH_URL:           process.env.NEXTAUTH_URL ?? "(not set)",
    AUTH_URL:               process.env.AUTH_URL ?? "(not set)",
    AUTH_TRUST_HOST:        process.env.AUTH_TRUST_HOST ?? "(not set)",
    VERCEL_URL:             process.env.VERCEL_URL ?? "(not set)",
    NODE_ENV:               process.env.NODE_ENV ?? "(not set)",
    auth0Domain_raw:        auth0Domain ?? "(not set)",
    auth0ClientId_set:      !!auth0ClientId,
    auth0ClientId_length:   auth0ClientId?.length ?? 0,
    auth0Secret_set:        !!auth0Secret,
    auth0Secret_length:     auth0Secret?.length ?? 0,
    auth0Issuer_raw:        rawIssuer ?? "(not set)",
    auth0Issuer_computed:   computedIssuer ?? "(not set)",
    POSTGRES_URL_set:       !!process.env.POSTGRES_URL,
  };

  // Test DB connectivity
  try {
    const [result] = await db.select({ count: count() }).from(users);
    checks.db_connected = true;
    checks.db_user_count = result.count;
  } catch (e) {
    checks.db_connected = false;
    checks.db_error = (e as Error).message;
    checks.db_error_name = (e as Error).name;
    checks.db_error_cause = String((e as { cause?: unknown }).cause ?? "");
    // Try a raw query to test basic connectivity
    try {
      const { sql: vsql } = await import("@vercel/postgres");
      const res = await vsql`SELECT 1 as test`;
      checks.db_raw_connected = true;
      checks.db_raw_result = res.rows[0];
      // Check if users table exists
      const tables = await vsql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
      checks.db_tables = tables.rows.map((r: Record<string, string>) => r.tablename);
    } catch (rawErr) {
      checks.db_raw_connected = false;
      checks.db_raw_error = (rawErr as Error).message;
    }
  }

  // Test OIDC discovery
  if (computedIssuer) {
    try {
      const discoveryUrl = `${computedIssuer}.well-known/openid-configuration`;
      checks.discoveryUrl = discoveryUrl;
      const res = await fetch(discoveryUrl, { signal: AbortSignal.timeout(5000) });
      checks.discoveryStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        checks.discoveryIssuer = data.issuer;
        checks.discoveryAuthEndpoint = data.authorization_endpoint;
        checks.discoveryTokenEndpoint = data.token_endpoint;
        checks.issuerMatch = computedIssuer === data.issuer;
      } else {
        checks.discoveryBody = await res.text().catch(() => "(read failed)");
      }
    } catch (e) {
      checks.discoveryError = (e as Error).message;
    }
  }

  // Test token endpoint connectivity (just a HEAD, not an actual token request)
  if (auth0Domain) {
    try {
      const tokenUrl = `https://${auth0Domain}/oauth/token`;
      const res = await fetch(tokenUrl, { method: "POST", body: "{}", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000) });
      checks.tokenEndpointReachable = true;
      checks.tokenEndpointStatus = res.status;
    } catch (e) {
      checks.tokenEndpointReachable = false;
      checks.tokenEndpointError = (e as Error).message;
    }
  }

  return NextResponse.json(checks, { headers: { "Cache-Control": "no-store" } });
}
