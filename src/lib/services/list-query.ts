/**
 * Shared list-endpoint contract (audit P1 — no list endpoint had pagination
 * or search). Backward compatible: absent params keep today's
 * return-everything behavior; `?limit=&offset=&q=` opt into paging + search.
 */
export interface ListParams {
  limit: number | null;
  offset: number;
  q: string | null;
}

const MAX_LIMIT = 200;

export function parseListParams(url: URL): ListParams {
  const rawLimit = url.searchParams.get("limit");
  const rawOffset = url.searchParams.get("offset");
  const rawQ = url.searchParams.get("q");

  const limit = rawLimit != null ? Math.min(Math.max(parseInt(rawLimit, 10) || 0, 1), MAX_LIMIT) : null;
  const offset = rawOffset != null ? Math.max(parseInt(rawOffset, 10) || 0, 0) : 0;
  const q = rawQ?.trim() ? rawQ.trim() : null;
  return { limit, offset, q };
}

/** SQL LIKE pattern for a case-insensitive contains search. */
export function likePattern(q: string): string {
  return `%${q.replace(/[%_]/g, "\\$&")}%`;
}
