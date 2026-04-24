/**
 * Tests for cn() utility — used throughout the app for className composition.
 */
import { cn } from "@/lib/utils";

describe("cn (class name utility)", () => {
  test("merges two class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("conditionally includes class when value is truthy", () => {
    expect(cn("base", true && "active")).toBe("base active");
  });

  test("excludes class when value is falsy", () => {
    expect(cn("base", false && "hidden")).toBe("base");
  });

  test("resolves Tailwind conflicts — last wins", () => {
    // tailwind-merge: bg-blue-500 overrides bg-red-500
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  test("handles undefined and null without throwing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => cn("a", undefined, null as any, "b")).not.toThrow();
  });

  test("handles empty input", () => {
    expect(cn()).toBe("");
  });
});
