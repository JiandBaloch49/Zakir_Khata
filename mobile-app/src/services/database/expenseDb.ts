import { getDatabase } from './db';
import { Expense } from '../../types/expense.types';
import { writeWithSync } from './syncHelpers';
import { userScope, userScopeParams } from './queryHelpers';
import { parseDateValue, localDate } from '../../utils/dates';

export type ExpenseFilter = {
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
};

/** One predicate for both rows and whole-result paisa aggregates. */
export const getFilteredExpenses = async (userId: string, filter: ExpenseFilter = {}, limit = -1, offset = 0) => {
  for (const date of [filter.startDate, filter.endDate]) {
    if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseDateValue(date))) {
      throw new Error('Invalid date range.');
    }
  }
  if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) throw new Error('From date must not be after To date.');
  let where = `${userScope('user_id')} AND is_deleted = 0`;
  const params: (string | number)[] = [...userScopeParams(userId)];
  if (filter.startDate || filter.endDate) {
    where += ' AND date(expense_date) BETWEEN date(?) AND date(?)';
    params.push(filter.startDate || '0001-01-01', filter.endDate || '9999-12-31');
  }
  const category = filter.category?.trim();
  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }
  const search = filter.search?.trim();
  if (search) {
    // Literal substring search: %, _ and quotes are text, never SQL wildcards.
    where += ` AND (instr(lower(COALESCE(description, '')), ?) > 0
                 OR instr(lower(COALESCE(note, '')), ?) > 0
                 OR instr(lower(COALESCE(category, '')), ?) > 0)`;
    const needle = search.toLowerCase();
    params.push(needle, needle, needle);
  }
  const db = await getDatabase();
  const expenses = await db.getAllAsync<Expense>(
    `SELECT * FROM expenses WHERE ${where} ORDER BY expense_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  // amount is integer paisa (v29). Summed by SQL over the WHOLE filtered set, never
  // from the returned page, so the total cannot drift from the list.
  const summary = await db.getFirstAsync<{ totalExpense: number }>(
    `SELECT COALESCE(SUM(amount), 0) as totalExpense FROM expenses WHERE ${where}`, params
  );
  return { expenses, expenseSummary: { totalExpense: summary?.totalExpense ?? 0 } };
};

export const addExpenseRecord = async (
  expense: Omit<Expense, 'id' | 'created_at' | 'synced' | 'is_deleted'>
): Promise<Expense> => {
  const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const data = {
    ...expense,
    id,
    is_deleted: 0,
    deleted_at: null
  };

  await writeWithSync({
    tableName: 'expenses',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${expense.user_id}/expenses/${id}`,
    userId: expense.user_id
  });

  return {
    ...expense,
    id,
    created_at: now,
    updated_at: now,
    synced: 0
  } as Expense;
};

export const getExpensesByMonth = async (userId: string, targetDate: Date): Promise<Expense[]> => {
  const db = await getDatabase();


  // Local month, not UTC: in PKT, toISOString() on the 1st before 05:00 returns
  // the PREVIOUS month, which silently reported the wrong month's expenses.
  const monthStr = localDate(targetDate).slice(0, 7); // YYYY-MM

  try {
    const records = await db.getAllAsync<any>(
      `SELECT * FROM expenses 
        WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
         AND is_deleted = 0
         AND strftime('%Y-%m', expense_date) = ?
       ORDER BY expense_date DESC, created_at DESC`,
      [userId, userId, userId, monthStr]
    );
    return records as Expense[];
  } catch (err) {
    console.warn('getExpensesByMonth skipped (migration pending)', err);
    return [];
  }
};

export const getMonthlyExpenseTotal = async (userId: string, targetDate: Date): Promise<number> => {
  const db = await getDatabase();


  // Local month, not UTC: in PKT, toISOString() on the 1st before 05:00 returns
  // the PREVIOUS month, which silently reported the wrong month's expenses.
  const monthStr = localDate(targetDate).slice(0, 7); // YYYY-MM

  try {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(amount) as total FROM expenses 
        WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
         AND is_deleted = 0
         AND strftime('%Y-%m', expense_date) = ?`,
      [userId, userId, userId, monthStr]
    );
    return result?.total || 0;
  } catch (err) {
    console.warn('getMonthlyExpenseTotal skipped (migration pending)', err);
    return 0;
  }
};

export const calculateTodayExpenses = async (userId: string): Promise<number> => {
  const db = await getDatabase();


  try {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(amount) as total FROM expenses 
        WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
         AND is_deleted = 0
         AND date(expense_date) = date('now', 'localtime')`,
      [userId, userId, userId]
    );
    return result?.total || 0;
  } catch (err) {
    console.warn('calculateTodayExpenses failed', err);
    return 0;
  }
};

export const getExpensesByUserId = async (
  userId: string,
  limit = 50,
  offset = 0
): Promise<Expense[]> => {
  const db = await getDatabase();


  try {
    const records = await db.getAllAsync<any>(
      `SELECT * FROM expenses 
        WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
         AND is_deleted = 0
       ORDER BY expense_date DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, userId, userId, limit, offset]
    );
    return records as Expense[];
  } catch (err) {
    console.warn('getExpensesByUserId skipped (migration pending)', err);
    return [];
  }
};

export const getExpenseBalanceSummary = async (
  userId: string
): Promise<{ totalExpense: number }> => {
  const db = await getDatabase();


  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(amount) as total FROM expenses 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0`,
    [userId, userId, userId]
  );

  return { totalExpense: result?.total || 0 };
};

export const deleteExpenseRecord = async (id: string, userId: string): Promise<void> => {
  await writeWithSync({
    tableName: 'expenses',
    recordId: id,
    operation: 'delete',
    data: { id, is_deleted: 1 },
    firestorePath: `users/${userId}/expenses/${id}`,
    userId
  });
};

export async function getPendingSyncExpenses(userId: string) {
  const db = await getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM expenses WHERE user_id = ? AND synced = 0',
    [userId]
  );
}
