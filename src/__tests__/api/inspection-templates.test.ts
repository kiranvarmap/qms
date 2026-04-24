/**
 * @jest-environment node
 *
 * Unit tests for /api/inspection-templates (GET, POST).
 * DB and auth are fully mocked — no database required.
 */
import { GET, POST } from "@/app/api/inspection-templates/route";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}));

jest.mock("@/lib/db/schema", () => ({
  inspectionTemplates: {},
  templateSections: {},
  templateQuestions: {},
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  asc: jest.fn((a: unknown) => a),
  desc: jest.fn((a: unknown) => a),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockDb = db as unknown as { select: jest.Mock; insert: jest.Mock };

// ── helpers ────────────────────────────────────────────────────────────────

function makeRequest(method = "GET", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/inspection-templates", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── GET tests ──────────────────────────────────────────────────────────────

describe("GET /api/inspection-templates", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Unauthorized");
  });

  test("returns 200 with template list when authenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1", role: "admin" } });

    // Each db.select() call returns an object where the LAST method in the chain
    // resolves the promise. All queries here end with .orderBy().
    function makeChain(result: unknown): Record<string, jest.Mock> {
      const obj: Record<string, jest.Mock> = {
        from: jest.fn(() => obj),
        where: jest.fn(() => obj),
        orderBy: jest.fn(() => Promise.resolve(result)),
      };
      return obj;
    }

    // Call order: 1 templates query, 1 sections query (for t1), 1 questions query (for s1)
    mockDb.select
      .mockReturnValueOnce(makeChain([{ id: "t1", title: "Template 1", isPublished: true, scoringEnabled: false, createdBy: "user-1", createdAt: new Date(), updatedAt: new Date() }]))
      .mockReturnValueOnce(makeChain([{ id: "s1", templateId: "t1", title: "General", position: 0 }]))
      .mockReturnValueOnce(makeChain([])); // questions for s1

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("id", "t1");
    expect(body[0]).toHaveProperty("sections");
    expect(body[0].sections[0]).toHaveProperty("questions");
  });
});

// ── POST tests ─────────────────────────────────────────────────────────────

describe("POST /api/inspection-templates", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(makeRequest("POST", { title: "New Template" }));
    expect(res.status).toBe(401);
  });

  test("returns 400 when title is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    const res = await POST(makeRequest("POST", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("creates template and default section when authenticated with valid title", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });

    const created = { id: "t-new", title: "My Template", isPublished: false };
    const createdSection = { id: "s-new", templateId: "t-new", title: "General", position: 1 };

    function insertChain(result: unknown): Record<string, jest.Mock> {
      const obj: Record<string, jest.Mock> = {
        values: jest.fn(() => obj),
        returning: jest.fn(() => Promise.resolve([result])),
      };
      return obj;
    }

    mockDb.insert
      .mockReturnValueOnce(insertChain(created))
      .mockReturnValueOnce(insertChain(createdSection));

    const res = await POST(makeRequest("POST", { title: "My Template" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id", "t-new");
    expect(body).toHaveProperty("sections");
    expect(body.sections).toHaveLength(1);
  });
});
