/**
 * Keyset ("seek") pagination for the list screens.
 *
 * Every getFiltered* query already orders by `<date> DESC, <createdAt> DESC, id DESC`.
 * A page cursor is simply those three keys of the LAST row loaded; the next page
 * is "everything strictly after that in the same order". Unlike LIMIT/OFFSET this
 * is stable while the user scrolls: a row inserted or deleted meanwhile cannot
 * shift, duplicate or skip anything already loaded, and each page is an index seek
 * rather than a scan.
 *
 * THE RULE: the cursor clause is appended to the ROWS query only. Every summary and
 * day-subtotal aggregate keeps the un-cursored WHERE, so totals describe the whole
 * filtered set no matter how many pages are on screen.
 */

export const PAGE_SIZE = 50;

export type PageCursor = { date: string; createdAt: string; id: string };

/** createdAt is optional: a table with no creation timestamp pages on (date, id). */
export type PageColumns = { date: string; createdAt?: string; id?: string };

/**
 * SQL predicate selecting rows that come AFTER the cursor in
 * `date DESC, createdAt DESC, id DESC` order. createdAt is COALESCEd so a legacy
 * NULL sorts last (as ORDER BY DESC already places it) instead of vanishing.
 */
export const keysetClause = ({ date, createdAt, id = 'id' }: PageColumns): string =>
  createdAt
    ? `(${date} < ? OR (${date} = ? AND (COALESCE(${createdAt}, '') < ? OR (COALESCE(${createdAt}, '') = ? AND ${id} < ?))))`
    : `(${date} < ? OR (${date} = ? AND ${id} < ?))`;

export const keysetParams = (c: PageCursor, cols?: PageColumns): string[] =>
  cols && !cols.createdAt ? [c.date, c.date, c.id] : [c.date, c.date, c.createdAt, c.createdAt, c.id];

/** The cursor a page hands back: its last row's keys, or null when the page was short (end reached). */
export const nextCursorOf = <T extends Record<string, any>>(
  rows: T[],
  limit: number,
  cols: PageColumns
): PageCursor | null => {
  if (limit <= 0 || rows.length < limit) return null;
  const last = rows[rows.length - 1];
  return { date: String(last[cols.date]), createdAt: cols.createdAt ? String(last[cols.createdAt] ?? '') : '', id: String(last[cols.id ?? 'id']) };
};
