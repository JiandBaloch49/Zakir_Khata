import { create } from 'zustand';
import { Expense } from '../types/expense.types';
import {
  getFilteredExpenses,
  ExpenseFilter,
  addExpenseRecord,
  deleteExpenseRecord
} from '../services/database/expenseDb';
import { todayDate } from '../utils/dates';

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  /** SQL total over the WHOLE filtered set — never a sum of the loaded page. */
  expenseTotal: number;
  /** Kept as an alias of expenseTotal so the summary card and list can never disagree. */
  monthlyTotal: number;
  filter: ExpenseFilter;

  fetchExpenses: (userId: string, filter?: ExpenseFilter) => Promise<void>;
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
  error: null,
  expenseTotal: 0,
  monthlyTotal: 0,
  // Empty = all dates. The old `currentDate` month cursor is gone: setMonth() was
  // never called, so previous months were unreachable. The range control replaces it.
  filter: {},

  fetchExpenses: async (userId: string, filter?: ExpenseFilter) => {
    set({ loading: true, error: null });
    const active = filter ?? get().filter;
    try {
      // List and total come from ONE call sharing ONE WHERE clause.
      const { expenses, expenseSummary } = await getFilteredExpenses(userId, active);
      set({
        expenses,
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

