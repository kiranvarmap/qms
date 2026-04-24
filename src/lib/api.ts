import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { logger } from "@/lib/logger";

// ── Response helpers ──────────────────────────────────────────────────
export const ok      = <T>(data: T)                        => NextResponse.json(data);
export const created = <T>(data: T)                        => NextResponse.json(data, { status: 201 });
export const noContent = ()                                 => new NextResponse(null, { status: 204 });
export const badRequest = (error: string, details?: unknown) =>
  NextResponse.json({ error, ...(details !== undefined ? { details } : {}) }, { status: 400 });
export const unauthorized = (error = "Unauthorized")       => NextResponse.json({ error }, { status: 401 });
export const forbidden    = (error = "Forbidden")          => NextResponse.json({ error }, { status: 403 });
export const notFound     = (error = "Not found")          => NextResponse.json({ error }, { status: 404 });
export const conflict     = (error: string)                => NextResponse.json({ error }, { status: 409 });
export const serverError  = (error = "Internal server error") => NextResponse.json({ error }, { status: 500 });

// ── Zod error helper ──────────────────────────────────────────────────
export function validationError(err: ZodError) {
  return badRequest("Validation failed", err.flatten().fieldErrors);
}

// ── Route wrapper with unified error handling ─────────────────────────
export async function apiHandler(
  fn: () => Promise<NextResponse>,
  context?: { route?: string }
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err: unknown) {
    const { ZodError } = await import("zod");
    if (err instanceof ZodError) return validationError(err);

    logger.error("Unhandled route error", {
      route: context?.route,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return serverError();
  }
}
