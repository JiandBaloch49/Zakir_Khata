import { getDatabase } from './db';
import { Transaction } from '../../types';
import { writeWithSync } from './syncHelpers';
import { userScope, userScopeParams } from './queryHelpers';
import { parseDateValue } from '../../utils/dates';
import { keysetClause, keysetParams, nextCursorOf, PageCursor } from './pagination';

export type KhataFilter = {
  startDate?: string;
  endDate?: string;
  type?: 'all' | 'lena' | 'dena';
  search?: string;
};

/** Per-calendar-day subtotal of the filtered ledger, for the Khata list's day headers. */
export type KhataDayTotal = { day: string; lena: number; dena: number; entryCount: number };

/**
 * THE one predicate for the Khata list: rows, the Lena/Dena/Net summary and the
 * per-day subtotals are all built from here, so none of them can disagree.
 */
const khataWhere = (userId: string, filter: KhataFilter) => {
  for (const date of [filter.startDate, filter.endDate]) {
    if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseDateValue(date))) {
      throw new Error('Invalid date range.');
    }
  }
  if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) throw new Error('From date must not be after To date.');
  if (filter.type && !['all', 'lena', 'dena'].includes(filter.type)) throw new Error('Invalid transaction type.');
  let where = `${userScope('userId')} AND isDeleted = 0`;
  const params: (string | number)[] = [...userScopeParams(userId)];
  if (filter.startDate || filter.endDate) {
    where += ' AND date(date) BETWEEN date(?) AND date(?)';
    params.push(filter.startDate || '0001-01-01', filter.endDate || '9999-12-31');
  }
  if (filter.type && filter.type !== 'all') {
    where += ' AND type = ?';
    params.push(filter.type);
  }
  if (filter.search) {
    // Literal substring search: %, _ and quotes are text, never SQL wildcards.
    where += " AND (instr(lower(COALESCE(partyName, '')), ?) > 0 OR instr(lower(COALESCE(notes, '')), ?) > 0)";
    params.push(filter.search.toLowerCase(), filter.search.toLowerCase());
  }
  return { where, params };
};

const KHATA_KEYS = { date: 'date', createdAt: 'createdAt', id: 'id' } as const;

/**
 * One predicate for both rows and whole-result paisa aggregates.
 *
 * Paging: pass `after` (the previous page's cursor) for the next `limit` rows in
 * `date DESC, createdAt DESC, id DESC` order. The cursor is applied to the ROWS
 * query ONLY — balanceSummary always covers the whole filtered set, so Total Lena /
 * Dena / Net never depend on how many pages are loaded. `limit/offset` remain for
 * existing callers.
 */
export const getFilteredKhata = async (
  userId: string, filter: KhataFilter = {}, limit = -1, offset = 0, after?: PageCursor | null
) => {
  const { where, params } = khataWhere(userId, filter);
  const db = await getDatabase();
  const rowsWhere = after ? `${where} AND ${keysetClause(KHATA_KEYS)}` : where;
  const rowsParams = after ? [...params, ...keysetParams(after)] : params;
  const transactions = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE ${rowsWhere} ORDER BY date DESC, createdAt DESC, id DESC LIMIT ? OFFSET ?`,
    [...rowsParams, limit, offset]
  );
  const summary = await db.getFirstAsync<{ totalLena: number; totalDena: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'lena' THEN amount_paisa ELSE 0 END), 0) as totalLena,
      COALESCE(SUM(CASE WHEN type = 'dena' THEN amount_paisa ELSE 0 END), 0) as totalDena
     FROM transactions WHERE ${where}`, params
  );
  const { totalLena = 0, totalDena = 0 } = summary || {};
  return {
    transactions,
    balanceSummary: { totalLena, totalDena, netBalance: totalLena - totalDena },
    nextCursor: nextCursorOf(transactions, limit, KHATA_KEYS),
  };
};

/**
 * Every calendar day in the filtered ledger with its own SQL subtotal — ONE query per
 * filter change, never per page, never a sum of loaded rows. Keyed by date(date) so
 * legacy timestamp rows fall on their day.
 */
export const getKhataDayTotals = async (userId: string, filter: KhataFilter = {}): Promise<KhataDayTotal[]> => {
  const { where, params } = khataWhere(userId, filter);
  const db = await getDatabase();
  return db.getAllAsync<KhataDayTotal>(
    `SELECT date(date) AS day,
            COALESCE(SUM(CASE WHEN type = 'lena' THEN amount_paisa ELSE 0 END), 0) AS lena,
            COALESCE(SUM(CASE WHEN type = 'dena' THEN amount_paisa ELSE 0 END), 0) AS dena,
            COUNT(*) AS entryCount
       FROM transactions WHERE ${where}
      GROUP BY date(date)
      ORDER BY day DESC`, params
  );
};

export type { Transaction };

export const createTransaction = async (
  userId: string,
  partyName: string,
  amount_paisa: number,
  type: 'lena' | 'dena',
  notes?: string,
  date?: string,
  partyNameUr?: string
): Promise<Transaction> => {
  const id = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();
  const transactionDate = date || now.split('T')[0];

  const data = {
    id, userId, partyName, party_name_ur: partyNameUr ?? null, amount_paisa, type, 
    notes: notes ?? null, date: transactionDate, isDeleted: 0, deletedAt: null
  };

  await writeWithSync({
    tableName: 'transactions',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${userId}/transactions/${id}`,
    userId
  });

  return { ...data, syncStatus: 'pending', synced: 0, createdAt: now, updatedAt: now } as any;
};

export const getTransactionById = async (id: string): Promise<Transaction | null> => {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Transaction>(
    'SELECT * FROM transactions WHERE id = ? AND isDeleted = 0 LIMIT 1',
    [id]
  );
  return result ?? null;
};

export const getTransactionsByUserId = async (
  userId: string,
  limit = 50,
  offset = 0
): Promise<Transaction[]> => {
  const db = await getDatabase();

  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions 
      WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND isDeleted = 0 
     ORDER BY date DESC, createdAt DESC 
     LIMIT ? OFFSET ?`,
    [userId, userId, userId, limit, offset]
  );
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
  const db = await getDatabase();
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY date DESC, createdAt DESC'
  );
};

// Returns paisa totals per type for a user. Correct even for >50 rows.
export const getBalanceSummary = async (
  userId: string
): Promise<{ totalLena: number; totalDena: number }> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ type: string; total: number }>(
    `SELECT type, SUM(amount_paisa) as total
     FROM transactions
      WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) AND isDeleted = 0
     GROUP BY type`,
    [userId, userId, userId]
  );
  let totalLena = 0;
  let totalDena = 0;
  for (const r of rows) {
    if (r.type === 'lena') totalLena = r.total;
    else if (r.type === 'dena') totalDena = r.total;
  }
  return { totalLena, totalDena };
};

export const updateTransaction = async (
  id: string,
  userId: string,
  updates: Partial<Pick<Transaction, 'partyName' | 'amount_paisa' | 'type' | 'notes' | 'date'>>
): Promise<void> => {
  await writeWithSync({
    tableName: 'transactions',
    recordId: id,
    operation: 'update',
    data: updates,
    firestorePath: `users/${userId}/transactions/${id}`,
    userId
  });
};

export const deleteTransaction = async (id: string, userId: string): Promise<void> => {
  await writeWithSync({
    tableName: 'transactions',
    recordId: id,
    operation: 'delete',
    data: {},
    firestorePath: `users/${userId}/transactions/${id}`,
    userId
  });
};

export const getPendingSyncTransactions = async (): Promise<Transaction[]> => {
  const db = await getDatabase();
  return db.getAllAsync<Transaction>(
    "SELECT * FROM transactions WHERE syncStatus = 'pending' AND isDeleted = 0 ORDER BY createdAt ASC"
  );
};

export const getPartyBalances = async (
  userId: string
): Promise<Array<{ partyName: string; totalLena: number; totalDena: number; netBalance: number; phone?: string; notes?: string; lastTransactionDate?: string }>> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ partyName: string; type: string; total: number; maxDate: string }>(
    `SELECT partyName, type, SUM(amount_paisa) as total, MAX(date) as maxDate
     FROM transactions
      WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) AND isDeleted = 0
     GROUP BY partyName, type
     ORDER BY partyName`,
    [userId, userId, userId]
  );

  const customers = await db.getAllAsync<{ name: string; phone: string; notes: string }>(
    `SELECT name, phone, notes FROM customers WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) AND is_deleted = 0`,
    [userId, userId, userId]
  );
  
  const customerMap = new Map<string, { phone: string; notes: string }>();
  const map = new Map<string, { totalLena: number; totalDena: number; lastTransactionDate: string }>();

  // Initialize all formal customers first
  for (const c of customers) {
    customerMap.set(c.name, c);
    map.set(c.name, { totalLena: 0, totalDena: 0, lastTransactionDate: '' });
  }

  // Merge in transaction balances
  for (const r of rows) {
    if (!map.has(r.partyName)) {
      map.set(r.partyName, { totalLena: 0, totalDena: 0, lastTransactionDate: r.maxDate });
    }
    const entry = map.get(r.partyName)!;
    if (r.type === 'lena') entry.totalLena += r.total;
    else entry.totalDena += r.total;
    
    if (!entry.lastTransactionDate || r.maxDate > entry.lastTransactionDate) {
      entry.lastTransactionDate = r.maxDate;
    }
  }

  return Array.from(map.entries()).map(([partyName, v]) => ({
    partyName,
    totalLena: v.totalLena,
    totalDena: v.totalDena,
    netBalance: v.totalLena - v.totalDena,
    lastTransactionDate: v.lastTransactionDate,
    phone: customerMap.get(partyName)?.phone,
    notes: customerMap.get(partyName)?.notes
  }));
};

export const getTransactionsByParty = async (
  userId: string,
  partyName: string
): Promise<Transaction[]> => {
  const db = await getDatabase();
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions 
      WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND partyName = ? 
       AND isDeleted = 0 
     ORDER BY date DESC, createdAt DESC`,
    [userId, userId, userId, partyName]
  );
};

export const getAllStaffMetricsAggregate = async (adminId: string): Promise<Record<string, { totalLena: number; totalDena: number; netBalance: number }>> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ userId: string; type: string; total: number }>(
    `SELECT userId, type, SUM(amount_paisa) as total
     FROM transactions
     WHERE isDeleted = 0
       AND userId IN (SELECT id FROM users WHERE parentId = ? OR parentId IN (SELECT id FROM users WHERE parentId = ?))
     GROUP BY userId, type`,
    [adminId, adminId]
  );
  
  const map: Record<string, { totalLena: number; totalDena: number; netBalance: number }> = {};
  for (const r of rows) {
    if (!map[r.userId]) map[r.userId] = { totalLena: 0, totalDena: 0, netBalance: 0 };
    if (r.type === 'lena') map[r.userId].totalLena += r.total;
    else if (r.type === 'dena') map[r.userId].totalDena += r.total;
  }
  
  for (const key in map) {
    map[key].netBalance = map[key].totalLena - map[key].totalDena;
  }
  return map;
};
