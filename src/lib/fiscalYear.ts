/**
 * Fiscal year utilities.
 * Fiscal year ends in April. FY starts May, ends April next year.
 * Example: 2026年4月期 = 2025-05 to 2026-04
 */

export const CURRENT_MONTH = "2026-03";

/** Get fiscal year label like "2026年4月期" for a given month string (YYYY-MM) */
export function getFiscalYearLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const fyEnd = m >= 5 ? y + 1 : y;
  return `${fyEnd}年4月期`;
}

/** Get fiscal month number (1-12, where May=1, April=12) */
export function getFiscalMonthNumber(yearMonth: string): number {
  const m = parseInt(yearMonth.split("-")[1], 10);
  return m >= 5 ? m - 4 : m + 8;
}

/** Get all 12 months for a fiscal year ending in the given April.
 *  e.g. fyEndYear=2026 → ["2025-05", ..., "2026-04"]
 */
export function getFiscalYearMonths(fyEndYear: number = 2026): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((i + 4) % 12) + 1; // 5,6,7,...,12,1,2,3,4
    const y = m >= 5 ? fyEndYear - 1 : fyEndYear;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

/** Get the fiscal year end year for a given month */
export function getFiscalEndYear(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return m >= 5 ? y + 1 : y;
}

/** Month label like "5月", "6月", etc. */
export function getMonthLabel(yearMonth: string): string {
  const m = parseInt(yearMonth.split("-")[1], 10);
  return `${m}月`;
}

export const ORG_ID = "00000000-0000-0000-0000-000000000001";
