import { getDatabase } from './db';
import { assertAllowedUpdateFields } from './updateFields';
import { CashEntry } from '../../types';
import { writeWithSync } from './syncHelpers';
import { todayDate, parseDateValue } from '../../utils/dates';
import { userScope, userScopeParams } from './queryHelpers';

export type CashHistoryFilter = {
  startDate?: string;
  endDate?: string;
  direction?: 'all' | 'in' | 'out';
  search?: string;
};

/** One predicate for both rows and whole-result paisa aggregates. */
export const getFilteredCashHistory = async (userId: string, filter: CashHistoryFilter = {}, limit = -1, offset = 0) => {
  for (const date of [filter.startDate, filter.endDate]) {
    if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseDateValue(date))) {
      throw new Error('Invalid date range.');
    }
  }
  if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) throw new Error('From date must not be after To date.');
  if (filter.direction && !['all', 'in', 'out'].includes(filter.direction)) throw new Error('Invalid cash direction.');
  let where = `${userScope('userId')} AND isDeleted = 0`;
  const params: (string | number)[] = [...userScopeParams(userId)];
  if (filter.startDate || filter.endDate) {
    where += ' AND date(date) BETWEEN date(?) AND date(?)';
    params.push(filter.startDate || '0001-01-01', filter.endDate || '9999-12-31');
  }
  if (filter.direction && filter.direction !== 'all') {
    where += ' AND direction = ?';
    params.push(filter.direction);
  }
  const search = filter.search?.trim();
  if (search) {
    // Literal substring search: %, _ and quotes are text, never SQL wildcards.
    where += " AND instr(lower(COALESCE(description, '')), ?) > 0";
    params.push(search.toLowerCase());
  }
  const db = await getDatabase();
  const entries = await db.getAllAsync<CashEntry>(
    `SELECT * FROM cashbook WHERE ${where} ORDER BY date DESC, createdAt DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const summary = await db.getFirstAsync<{ cashIn: number; cashOut: number }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_paisa ELSE 0 END), 0) as cashIn,
      COALESCE(SUM(CASE WHEN direction = 'out' THEN amount_paisa ELSE 0 END), 0) as cashOut
     FROM cashbook WHERE ${where}`, params
  );
  const { cashIn = 0, cashOut = 0 } = summary || {};
  return { entries, cashSummary: { cashIn, cashOut, cashBalance: cashIn - cashOut } };
};

export type { CashEntry };

export const createCashEntry = async (
  userId: string,
  description: string,
  amount_paisa: number,
  direction: 'in' | 'out',
  date?: string,
  attachment_url?: string | null,
  category?: string | null,
  note?: string | null
): Promise<CashEntry> => {
  const id = `cash_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();
  const entryDate = date || now.split('T')[0];

  const data = {
    id, userId, description, amount_paisa, direction, date: entryDate,
    isDeleted: 0, deletedAt: null, attachment_url: attachment_url || null,
    category: category || null, note: note || null
  };

  await writeWithSync({
    tableName: 'cashbook',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${userId}/cashbook/${id}`,
    userId
  });

  return { ...data, syncStatus: 'pending', synced: 0, createdAt: now, updatedAt: now } as any;
};

export const getCashEntryById = async (id: string): Promise<CashEntry | null> => {
  const db = await getDatabase();
  const result = await db.getFirstAsync<CashEntry>(
    'SELECT * FROM cashbook WHERE id = ? AND isDeleted = 0 LIMIT 1',
    [id]
  );
  return result ?? null;
};

export const getCashEntriesByUserId = async (
  userId: string,
  limit = 50,
  offset = 0
): Promise<CashEntry[]> => {
  const db = await getDatabase();
  return db.getAllAsync<CashEntry>(
    `SELECT * FROM cashbook 
      WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND isDeleted = 0 
     ORDER BY date DESC, createdAt DESC 
     LIMIT ? OFFSET ?`,
    [userId, userId, userId, limit, offset]
  );
};

export const getAllCashEntries = async (): Promise<CashEntry[]> => {
  const db = await getDatabase();
  return db.getAllAsync<CashEntry>(
    'SELECT * FROM cashbook WHERE isDeleted = 0 ORDER BY date DESC, createdAt DESC'
  );
};

// Returns paisa totals per direction for a user.
export const getCashBalanceSummary = async (
  userId: string
): Promise<{ cashIn: number; cashOut: number; cashBalance: number }> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ direction: string; total: number }>(
    `SELECT direction, SUM(amount_paisa) as total
     FROM cashbook
      WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) AND isDeleted = 0
     GROUP BY direction`,
    [userId, userId, userId]
  );
  let cashIn = 0;
  let cashOut = 0;
  for (const r of rows) {
    if (r.direction === 'in') cashIn = r.total ?? 0;
    else cashOut = r.total ?? 0;
  }
  return { cashIn, cashOut, cashBalance: cashIn - cashOut };
};

export const updateCashEntry = async (
  id: string,
  userId: string,
  updates: Partial<Pick<CashEntry, 'description' | 'amount_paisa' | 'direction' | 'date' | 'attachment_url' | 'category' | 'note'>>
): Promise<void> => {
  assertAllowedUpdateFields(updates, ["description","amount_paisa","direction","date","attachment_url","category","note"]);
  if (Object.keys(updates).length === 0) return;
  await writeWithSync({
    tableName: 'cashbook',
    recordId: id,
    operation: 'update',
    data: updates,
    firestorePath: `users/${userId}/cashbook/${id}`,
    userId
  });
};

export const deleteCashEntry = async (id: string, userId: string): Promise<void> => {
  await writeWithSync({
    tableName: 'cashbook',
    recordId: id,
    operation: 'delete',
    data: {},
    firestorePath: `users/${userId}/cashbook/${id}`,
    userId
  });
};

export const getPendingSyncCashEntries = async (): Promise<CashEntry[]> => {
  const db = await getDatabase();
  return db.getAllAsync<CashEntry>(
    "SELECT * FROM cashbook WHERE syncStatus = 'pending' AND isDeleted = 0 ORDER BY createdAt ASC"
  );
};

export type DayTotals = { cashIn: number; cashOut: number; net: number; entryCount: number };

/**
 * The Day Book for ONE calendar day: that day's entries plus its paisa totals.
 *
 * A new day starting "fresh" is a VIEW FILTER ONLY — nothing is deleted, moved or
 * hidden when the date changes. Every past day stays queryable forever by passing
 * its date here.
 *
 * Scoped with userScope() like every other book, so an owner sees their whole tree
 * for that day and a staff sees their own branch. Previously this read `userId = ?`
 * only, so an owner's day totals silently excluded their staff's entries while the
 * "Cash in Hand" figure beside them included the whole tree.
 *
 * `date(date) = date(?)` rather than string equality: a legacy row holding a full
 * timestamp still matches its calendar day instead of silently disappearing.
 */
export const getDayBook = async (
  userId: string,
  date: string = todayDate()
): Promise<{ entries: CashEntry[]; dayTotals: DayTotals }> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseDateValue(date)) {
    throw new Error('Invalid date.');
  }
  const where = `${userScope('userId')} AND isDeleted = 0 AND date(date) = date(?)`;
  const params = [...userScopeParams(userId), date];
  const db = await getDatabase();

  const entries = await db.getAllAsync<CashEntry>(
    `SELECT * FROM cashbook WHERE ${where} ORDER BY createdAt DESC, id DESC`,
    params
  );
  // Totals come from SQL over the same predicate, never a JS reduce over the rows.
  const totals = await db.getFirstAsync<{ cashIn: number; cashOut: number; entryCount: number }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_paisa ELSE 0 END), 0) as cashIn,
            COALESCE(SUM(CASE WHEN direction = 'out' THEN amount_paisa ELSE 0 END), 0) as cashOut,
            COUNT(*) as entryCount
       FROM cashbook WHERE ${where}`,
    params
  );
  const { cashIn = 0, cashOut = 0, entryCount = 0 } = totals || {};
  return { entries, dayTotals: { cashIn, cashOut, net: cashIn - cashOut, entryCount } };
};
