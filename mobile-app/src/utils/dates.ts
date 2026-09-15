/**
 * dates — the single source of truth for calendar dates in this app.
 *
 * WHY THIS EXISTS: every "today" was previously derived with
 * `new Date().toISOString().split('T')[0]`, which is **UTC**. For PKT (UTC+5) that
 * makes the calendar day flip at 05:00 local, not midnight — so between midnight
 * and 5 AM the Day Book asked for YESTERDAY's date string while new entries were
 * stamped with yesterday's date too.
 *
 * Stored dates are plain `YYYY-MM-DD` labels. Computing them locally never rewrites
 * anything already stored; it only stops us asking for the wrong day.
 */

/** A calendar date in the device's local timezone, as YYYY-MM-DD. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today in the device's local timezone, as YYYY-MM-DD. */
export const todayDate = (): string => localDate(new Date());

/** First and last day of the LOCAL current month — the range the list screens open on. */
export const thisMonthRange = (now: Date = new Date()): { startDate: string; endDate: string } => ({
  startDate: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
  endDate: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
});

/**
 * Parses a stored value into a local Date, or null if it isn't a real date.
 * Accepts `YYYY-MM-DD` and legacy full ISO timestamps (rows written before the
 * date format was unified). `YYYY-MM-DD` is parsed at local noon so that a
 * timezone offset can never shift it onto the neighbouring day.
 */
export const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null;
  const text = String(value).trim();

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
    // Rejects impossible values like 2026-99-99, which JS would otherwise roll over.
    if (
      parsed.getFullYear() !== Number(y) ||
      parsed.getMonth() !== Number(m) - 1 ||
      parsed.getDate() !== Number(d)
    ) return null;
    return parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** True when the value is a real calendar date this app can store. */
export const isValidDateValue = (value?: string | null): boolean => parseDateValue(value) !== null;

/**
 * Normalises any accepted value to YYYY-MM-DD, or null when unparseable.
 * Legacy ISO timestamps become their LOCAL calendar day.
 */
export const toDateValue = (value?: string | null): string | null => {
  const parsed = parseDateValue(value);
  return parsed ? localDate(parsed) : null;
};

/** Human-readable form for lists and detail screens; never throws on bad data. */
export const formatDisplayDate = (value?: string | null): string => {
  const parsed = parseDateValue(value);
  if (!parsed) return value ? String(value) : '—';
  return parsed.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};
