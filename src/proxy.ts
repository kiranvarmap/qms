import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimiters } from "@/lib/rate-limit";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // ── Skip static assets immediately — proxy must not touch these ───
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico" ||
    /\.\w+$/.test(pathname) // any file with an extension
  ) {
    return NextResponse.next();
  }

  // ── Rate limiting ──────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Don't rate-limit auth callbacks
  if (pathname.startsWith("/api/auth") && !pathname.startsWith("/api/auth/callback")) {
    const r = rateLimiters.auth(ip);
    if (!r.allowed)
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  } else if (pathname.startsWith("/api/upload")) {
    const r = rateLimiters.upload(ip);
    if (!r.allowed)
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  } else if (pathname.startsWith("/api/")) {
    const r = rateLimiters.api(ip);
    if (!r.allowed)
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Public routes ──────────────────────────────────────────────────
  const publicPages = ["/auth/signin", "/auth/signup", "/auth/error", "/auth/verify-request", "/time-clock", "/forms"];
  if (publicPages.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (pathname.startsWith("/api/forms/slug/")) return NextResponse.next();
  if (pathname.startsWith("/api/forms/") && pathname.endsWith("/submit")) return NextResponse.next();
  if (pathname.startsWith("/api/time-logs")) return NextResponse.next();
  if (pathname.startsWith("/api/employees") && method === "GET") return NextResponse.next();
  if ((pathname.startsWith("/api/emp-projects") || pathname.startsWith("/api/emp-tasks") || pathname.startsWith("/api/workshops")) && method === "GET") return NextResponse.next();

  // ── Auth check ─────────────────────────────────────────────────────
  let token = null;
  try {
    token = await getToken({ req, secret: process.env.AUTH_SECRET });
  } catch {
    // AUTH_SECRET missing — redirect to signin
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/auth/signin", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = token.role as string | undefined;

  // ── Admin-only pages ───────────────────────────────────────────────
  const adminPages = ["/dashboard/users", "/dashboard/employees", "/dashboard/emp-workshops", "/dashboard/emp-projects", "/dashboard/emp-reports"];
  if (adminPages.some((p) => pathname.startsWith(p)) && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/api/users") && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const empWritePaths = ["/api/employees", "/api/workshops", "/api/emp-projects", "/api/emp-tasks", "/api/emp-reports"];
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    empWritePaths.some((p) => pathname.startsWith(p)) &&
    role !== "admin" && role !== "manager"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}
