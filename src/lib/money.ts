/**
 * Money — integer minor units everywhere (Plan §2.3 / §13).
 *
 * Every monetary column in the business-ops modules stores an integer number
 * of minor units (cents) to avoid float drift. UI/JSON boundaries convert with
 * the helpers below; arithmetic stays in integers. Tax rates are stored as
 * basis points (1% = 100 bp) for the same reason.
 */

/** Parse a user-entered major-unit string/number ("12.34") → minor units (1234). */
export function toMinor(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Minor units (1234) → major-unit number (12.34) for display/serialization. */
export function toMajor(minor: number): number {
  return Math.round(minor) / 100;
}

/** Format minor units as a localized currency string. */
export function formatMoney(minor: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(toMajor(minor));
}

/**
 * Apply a basis-point tax rate to a minor-unit base, rounding to the nearest
 * minor unit. 7.5% (750 bp) of 10000 → 750.
 */
export function taxOf(baseMinor: number, rateBasisPoints: number): number {
  return Math.round((baseMinor * rateBasisPoints) / 10000);
}

/** Sum a list of minor-unit amounts (integer-safe). */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((acc, n) => acc + Math.round(n), 0);
}

/**
 * Compute a single line's amount in minor units: qty × unit price, then tax.
 * Returns { net, tax, total } all in minor units.
 */
export function lineTotals(
  quantity: number,
  unitPriceMinor: number,
  rateBasisPoints = 0
): { net: number; tax: number; total: number } {
  const net = Math.round(quantity * unitPriceMinor);
  const tax = taxOf(net, rateBasisPoints);
  return { net, tax, total: net + tax };
}
