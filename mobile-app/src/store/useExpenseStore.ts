import { create } from 'zustand';
import { Expense } from '../types/expense.types';
import {
  getFilteredExpenses,
  getExpenseDayTotals,
  ExpenseDayTotal,
  ExpenseFilter,
  addExpenseRecord,
  deleteExpenseRecord
} from '../services/database/expenseDb';
import { todayDate, thisMonthRange } from '../utils/dates';
import { PAGE_SIZE, PageCursor } from '../services/database/pagination';

interface ExpenseStore {
  /** The pages loaded so far (keyset, PAGE_SIZE at a time). */
  expenses: Expense[];
  loading: boolean;
  loadingMore: boolean;
  /** Cursor for the next page; null once the last page is loaded. */
  cursor: PageCursor | null;
  /** Per-day SQL subtotals for the whole filtered set, keyed by YYYY-MM-DD. */
  dayTotals: Record<string, ExpenseDayTotal>;
  error: string | null;
  /** SQL total over the WHOLE filtered set — never a sum of the loaded page. */
  expenseTotal: number;
  /** Kept as an alias of expenseTotal so the summary card and list can never disagree. */
  monthlyTotal: number;
  filter: ExpenseFilter;

  fetchExpenses: (userId: string, filter?: ExpenseFilter) => Promise<void>;
  loadMoreExpenses: (userId: string) => Promise<void>;
  loadExpenses: (userId: string) => Promise<void>;
  addExpense: (
    arg1: Omit<Expense, 'id' | 'created_at' | 'synced' | 'is_deleted'> | string,
    amount_paisa?: number,
    notes?: string
  ) => Promise<void>;
  removeExpense: (id: string, userId: string) => Promise<void>;
  loadMonthlyTotal: (userId: string) => Promise<void>;
  setFilter: (userId: string, filter: ExpenseFilter) => Promise<void>;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  loading: false,
  loadingMore: false,
  cursor: null,
  dayTotals: {},
  error: null,
  expenseTotal: 0,
  monthlyTotal: 0,
  // Opens on this month (was: all dates). Unlike the old month cursor, the range
  // control is visible and every previous month stays reachable through it.
  filter: { ...thisMonthRange() },

  fetchExpenses: async (userId: string, filter?: ExpenseFilter) => {
    set({ loading: true, error: null, cursor: null });
    const active = filter ?? get().filter;
    try {
      // Page 1, the total and the per-day subtotals share ONE WHERE clause; the total
      // and day totals are whole-set SQL aggregates — only the rows page.
      const [{ expenses, expenseSummary, nextCursor }, days] = await Promise.all([
        getFilteredExpenses(userId, active, PAGE_SIZE),
        getExpenseDayTotals(userId, active),
      ]);
      set({
        expenses,
        cursor: nextCursor,
        dayTotals: Object.fromEntries(days.map(d => [d.day, d])),
        expenseTotal: expenseSummary.totalExpense,
        monthlyTotal: expenseSummary.totalExpense,
        filter: active,
        loading: false,
      });
    } catch (err: any) {
      if (__DEV__) console.error('[Expense] fetch failed:', err);
      set({ error: err?.message || 'Failed to fetch expenses', loading: false });
    }
  },

  // Next page only — strictly after the last loaded row. The total is NOT refetched.
  loadMoreExpenses: async (userId: string) => {
    const { cursor, loadingMore, loading, filter } = get();
    if (!cursor || loadingMore || loading) return;
    set({ loadingMore: true });
    try {
      const { expenses, nextCursor } = await getFilteredExpenses(userId, filter, PAGE_SIZE, 0, cursor);
      set(state => ({ expenses: [...state.expenses, ...expenses], cursor: nextCursor, loadingMore: false }));
    } catch (err: any) {
      if (__DEV__) console.error('[Expense] load more failed:', err);
      set({ loadingMore: false });
    }
  },

  loadExpenses: async (userId: string) => {
    await get().fetchExpenses(userId);
  },

  setFilter: async (userId: string, filter: ExpenseFilter) => {
    set({ filter });
    await get().fetchExpenses(userId, filter);
  },

  addExpense: async (arg1, amount_paisa, notes) => {
    try {
      let userId: string;
      if (typeof arg1 === 'string') {
        userId = arg1;
        const amountRupees = (amount_paisa ?? 0) / 100;
        await addExpenseRecord({
          user_id: userId,
          amount: amountRupees,
          description: notes || 'Expense',
          note: notes,
          expense_date: todayDate(),
        });
      } else {
        userId = arg1.user_id;
        await addExpenseRecord(arg1);
      }
      // Refresh expenses and monthly total
      await get().fetchExpenses(userId);
      await get().loadMonthlyTotal(userId);
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  removeExpense: async (id: string, userId: string) => {
    try {
      await deleteExpenseRecord(id, userId);
      await get().fetchExpenses(userId);
      await get().loadMonthlyTotal(userId);
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  /**
   * Retained so existing callers keep working. The total now always comes from the
   * same filtered query as the list, so this is just a refresh.
   */
  loadMonthlyTotal: async (userId: string) => {
    await get().fetchExpenses(userId);
  },
}));

