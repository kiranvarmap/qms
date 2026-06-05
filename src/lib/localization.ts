/**
 * Localization country packs (BRD 00 §12).
 *
 * A workspace selects a country; the pack below adapts the tax regime, the
 * party tax-identifier label, the statutory document set, default currency,
 * and locale formatting — so nothing is hard-coded to one country. Modules read
 * the pack via `getCountryPack(workspace.country)` instead of naming any single
 * country's tax form.
 */

export type TaxModel = "sales_tax" | "vat" | "gst";

export interface CountryPack {
  code: string;          // ISO 3166-1 alpha-2
  name: string;
  currency: string;      // ISO 4217
  locale: string;        // BCP-47
  taxModel: TaxModel;
  taxName: string;       // e.g. "Sales Tax", "VAT", "GST"
  /** Label + identifier type for a party's tax registration. */
  taxIdLabel: string;    // e.g. "EIN", "VAT No.", "GSTIN"
  /** Statutory documents collected during vendor onboarding. */
  vendorDocs: string[];
  /** Statutory documents collected for workforce/HR. */
  workforceDocs: string[];
  hasSubNationalTax: boolean; // e.g. US state/county sales tax
}

export const COUNTRY_PACKS: Record<string, CountryPack> = {
  US: {
    code: "US", name: "United States", currency: "USD", locale: "en-US",
    taxModel: "sales_tax", taxName: "Sales Tax", taxIdLabel: "EIN / TIN",
    vendorDocs: ["W-9", "W-8 (foreign)", "Insurance certificate"],
    workforceDocs: ["I-9 / work authorization", "W-4"],
    hasSubNationalTax: true,
  },
  GB: {
    code: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB",
    taxModel: "vat", taxName: "VAT", taxIdLabel: "VAT No.",
    vendorDocs: ["VAT certificate", "Insurance certificate"],
    workforceDocs: ["Right to work", "National Insurance No."],
    hasSubNationalTax: false,
  },
  IN: {
    code: "IN", name: "India", currency: "INR", locale: "en-IN",
    taxModel: "gst", taxName: "GST", taxIdLabel: "GSTIN / PAN",
    vendorDocs: ["GST certificate", "PAN card"],
    workforceDocs: ["PF / ESI ID", "Aadhaar / PAN"],
    hasSubNationalTax: true,
  },
  AE: {
    code: "AE", name: "United Arab Emirates", currency: "AED", locale: "en-AE",
    taxModel: "vat", taxName: "VAT", taxIdLabel: "TRN",
    vendorDocs: ["VAT (TRN) certificate", "Trade license"],
    workforceDocs: ["Emirates ID", "Work permit"],
    hasSubNationalTax: false,
  },
  AU: {
    code: "AU", name: "Australia", currency: "AUD", locale: "en-AU",
    taxModel: "gst", taxName: "GST", taxIdLabel: "ABN",
    vendorDocs: ["ABN registration", "Insurance certificate"],
    workforceDocs: ["TFN", "Work rights"],
    hasSubNationalTax: false,
  },
  CA: {
    code: "CA", name: "Canada", currency: "CAD", locale: "en-CA",
    taxModel: "gst", taxName: "GST/HST", taxIdLabel: "Business Number",
    vendorDocs: ["GST/HST registration", "Insurance certificate"],
    workforceDocs: ["SIN", "Work permit"],
    hasSubNationalTax: true,
  },
  DE: {
    code: "DE", name: "Germany", currency: "EUR", locale: "de-DE",
    taxModel: "vat", taxName: "VAT (USt)", taxIdLabel: "USt-IdNr.",
    vendorDocs: ["VAT certificate", "Trade registration"],
    workforceDocs: ["Right to work (EU)", "Tax ID (Steuer-ID)"],
    hasSubNationalTax: false,
  },
};

/** A safe generic fallback for unsupported countries. */
export const GENERIC_PACK: CountryPack = {
  code: "XX", name: "Generic", currency: "USD", locale: "en-US",
  taxModel: "vat", taxName: "Tax", taxIdLabel: "Tax registration No.",
  vendorDocs: ["Tax certificate", "Insurance certificate"],
  workforceDocs: ["Work authorization"],
  hasSubNationalTax: false,
};

export function getCountryPack(country?: string | null): CountryPack {
  if (!country) return GENERIC_PACK;
  return COUNTRY_PACKS[country.toUpperCase()] ?? GENERIC_PACK;
}

/** Country options for selection UIs. */
export function countryOptions() {
  return Object.values(COUNTRY_PACKS).map((p) => ({ code: p.code, name: p.name }));
}
