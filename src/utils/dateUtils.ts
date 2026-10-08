/**
 * Calendar-Date Utilities for Food Safety & Expiry Tracking
 * Avoids browser timezone / daylight savings off-by-one bugs by using pure UTC date-only math.
 */

/**
 * Returns today's calendar date in YYYY-MM-DD format using current local/specified time.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD into [year, month (1-based), day].
 */
export function parseDateParts(dateStr: string): [number, number, number] {
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date string for calendar calculation: "${dateStr}"`);
  }
  return [parts[0], parts[1], parts[2]];
}

/**
 * Calculates calendar days between two YYYY-MM-DD date strings.
 * Result = targetExpiryDate - currentDate
 *
 * e.g.
 * 2026-10-10 and 2026-10-10 => 0 days (Expiring Today)
 * 2026-10-11 and 2026-10-10 => 1 day
 * 2026-10-15 and 2026-10-10 => 5 days
 * 2026-10-09 and 2026-10-10 => -1 days (Expired)
 */
export function calculateDaysRemaining(expiryDateStr: string, currentDateStr?: string): number {
  if (!expiryDateStr) return 0;
  const [expY, expM, expD] = parseDateParts(expiryDateStr);
  const [curY, curM, curD] = parseDateParts(currentDateStr || getTodayDateString());

  const expUtc = Date.UTC(expY, expM - 1, expD);
  const curUtc = Date.UTC(curY, curM - 1, curD);

  const MS_PER_DAY = 86400000;
  return Math.round((expUtc - curUtc) / MS_PER_DAY);
}

/**
 * Computes calendar expiry date from production date + shelf life days.
 * Returns YYYY-MM-DD.
 */
export function addShelfLifeDays(productionDateStr: string, shelfLifeDays: number): string {
  const [y, m, d] = parseDateParts(productionDateStr);
  // Using Date.UTC to safely calculate date addition without timezone shifts
  const prodUtc = Date.UTC(y, m - 1, d);
  const expUtc = new Date(prodUtc + shelfLifeDays * 86400000);

  const expYear = expUtc.getUTCFullYear();
  const expMonth = String(expUtc.getUTCMonth() + 1).padStart(2, '0');
  const expDay = String(expUtc.getUTCDate()).padStart(2, '0');

  return `${expYear}-${expMonth}-${expDay}`;
}

/**
 * Formats a YYYY-MM-DD date string into a clean readable format (e.g., "10 Oct 2026").
 */
export function formatCalendarDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = parseDateParts(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
