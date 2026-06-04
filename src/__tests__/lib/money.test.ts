import { toMinor, toMajor, taxOf, sumMinor, lineTotals, formatMoney } from "@/lib/money";

describe("money — integer minor units (Plan §2.3)", () => {
  test("toMinor rounds major units to cents", () => {
    expect(toMinor(12.34)).toBe(1234);
    expect(toMinor("12.34")).toBe(1234);
    expect(toMinor(0.1 + 0.2)).toBe(30); // no float drift after rounding
    expect(toMinor("not a number")).toBe(0);
  });

  test("toMajor is the inverse of toMinor", () => {
    expect(toMajor(1234)).toBe(12.34);
    expect(toMajor(toMinor(99.99))).toBe(99.99);
  });

  test("taxOf applies basis points and rounds to nearest cent", () => {
    expect(taxOf(10000, 750)).toBe(750); // 7.5% of $100.00
    expect(taxOf(1999, 2000)).toBe(400); // 20% of $19.99 = 399.8 → 400
    expect(taxOf(5000, 0)).toBe(0);
  });

  test("sumMinor is integer-safe", () => {
    expect(sumMinor([100, 200, 333])).toBe(633);
    expect(sumMinor([])).toBe(0);
  });

  test("lineTotals computes net, tax, total", () => {
    expect(lineTotals(3, 1000, 1000)).toEqual({ net: 3000, tax: 300, total: 3300 });
    expect(lineTotals(2, 2599)).toEqual({ net: 5198, tax: 0, total: 5198 });
  });

  test("formatMoney renders a currency string", () => {
    expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
  });
});
