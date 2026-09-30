/**
 * Madhav Dairy - Batch Number Generator
 *
 * Pattern: [MonthCode][DD][YYYY]
 * - MonthCode: First 2 letters of English month name in uppercase.
 * - Explicit Exceptions:
 *     March -> MH
 *     May   -> MY
 *     June  -> JE
 *     July  -> JY
 * - DD: 2-digit zero-padded day (01-31).
 * - YYYY: 4-digit year.
 *
 * Examples:
 * 30 January 2026  -> JA302026
 * 15 March 2026    -> MH152026
 * 10 May 2026      -> MY102026
 * 15 June 2026     -> JE152026
 * 04 July 2026     -> JY042026
 */

export const MONTH_CODES: Record<number, string> = {
  1: 'JA',  // January
  2: 'FE',  // February
  3: 'MH',  // March (Explicit exception: MH)
  4: 'AP',  // April
  5: 'MY',  // May (Explicit exception: MY)
  6: 'JE',  // June (Explicit exception: JE)
  7: 'JY',  // July (Explicit exception: JY)
  8: 'AU',  // August
  9: 'SE',  // September
  10: 'OC', // October
  11: 'NO', // November
  12: 'DE', // December
};

export function generateBatchNumber(dateInput?: string | Date): string {
  if (!dateInput) {
    dateInput = new Date();
  }

  let year = '';
  let month = 1;
  let day = '';

  if (typeof dateInput === 'string') {
    // If format is YYYY-MM-DD, parse string components directly to avoid timezone distortion
    const match = dateInput.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      year = match[1];
      month = parseInt(match[2], 10);
      day = match[3].padStart(2, '0');
    } else {
      const d = new Date(dateInput);
      year = String(d.getFullYear());
      month = d.getMonth() + 1;
      day = String(d.getDate()).padStart(2, '0');
    }
  } else {
    year = String(dateInput.getFullYear());
    month = dateInput.getMonth() + 1;
    day = String(dateInput.getDate()).padStart(2, '0');
  }

  const monthCode = MONTH_CODES[month] || 'JA';
  return `${monthCode}${day}${year}`;
}
