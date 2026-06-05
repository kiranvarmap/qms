/**
 * Cell codecs — convert between DB values and CSV string cells per FieldType.
 */
import { toMinor, toMajor } from "@/lib/money";
import type { FieldDef } from "./registry";

/** DB value → CSV cell string. */
export function formatCell(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (field.type) {
    case "money": return toMajor(Number(value)).toFixed(2);
    case "bool": return value ? "true" : "false";
    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    case "json": return typeof value === "string" ? value : JSON.stringify(value);
    default: return String(value);
  }
}

/** CSV cell string → DB value. Throws on invalid numbers/dates. */
export function parseCell(field: FieldDef, raw: string): unknown {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  switch (field.type) {
    case "money": {
      const n = Number(s.replace(/[^0-9.\-]/g, ""));
      if (isNaN(n)) throw new Error(`"${field.header}" must be a number`);
      return toMinor(n);
    }
    case "int": {
      const n = parseInt(s, 10);
      if (isNaN(n)) throw new Error(`"${field.header}" must be an integer`);
      return n;
    }
    case "number": {
      const n = Number(s);
      if (isNaN(n)) throw new Error(`"${field.header}" must be a number`);
      return n;
    }
    case "bool": return /^(true|yes|y|1)$/i.test(s);
    case "date": {
      const d = new Date(s);
      if (isNaN(d.getTime())) throw new Error(`"${field.header}" must be a date`);
      return d;
    }
    case "json":
      try { return JSON.parse(s); } catch { throw new Error(`"${field.header}" must be valid JSON`); }
    default: return s;
  }
}
