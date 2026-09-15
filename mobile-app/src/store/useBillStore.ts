import { create } from 'zustand';
import { Bill, BillItem } from '../types/bill.types';
import { localDate } from '../utils/dates';
import { PAGE_SIZE, PageCursor } from '../services/database/pagination';
import {
  getFilteredBills,
  getBillDayTotals,
  BillDayTotal,
  billMatchesFilter,
  BillFilter,
  createBill,
} from '../services/database/billDb';

/** First and last day of the LOCAL current month, as YYYY-MM-DD. */
const thisMonth = () => {
  const now = new Date();
  return {
    startDate: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

export type BillSummary = { billCount: number; totalBilled: number; totalPaid: number; totalDue: number };

interface BillStore {
  /** The pages loaded so far (keyset, PAGE_SIZE at a time). */
  bills: Bill[];
  loading: boolean;
  loadingMore: boolean;
  /** Cursor for the next page; null once the last page is loaded. */
  cursor: PageCursor | null;
  /** Per-day SQL subtotals for the whole filtered set, keyed by YYYY-MM-DD. */
  dayTotals: Record<string, BillDayTotal>;
  error: string | null;
  /** SQL aggregates over the WHOLE filtered set — never a sum of the loaded page. */
  summary: BillSummary;
  /** Alias of summary.totalBilled, kept so existing callers read the filtered figure. */
  monthlySales: number;
  filter: BillFilter;

  fetchBills: (userId: string, filter?: BillFilter) => Promise<void>;
  loadMoreBills: (userId: string) => Promise<void>;
  setFilter: (userId: string, filter: BillFilter) => Promise<void>;
  addBill: (
    bill: Omit<Bill, 'id' | 'bill_no' | 'created_at' | 'synced' | 'is_deleted'> & { bill_no?: number },
    items: Omit<BillItem, 'id' | 'bill_id' | 'is_deleted'>[]
  ) => Promise<{ bill: Bill; inActiveFilter: boolean }>;
  updateBillRecord: (id: string, userId: string, updates: Partial<Bill>) => Promise<void>;
  updateBillItemRecord: (id: string, billId: string, userId: string, updates: Partial<BillItem>) => Promise<void>;
  loadMonthlySales: (userId: string) => Promise<void>;
}

const EMPTY_SUMMARY: BillSummary = { billCount: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 };

export const useBillStore = create<BillStore>((set, get) => ({
  bills: [],
  loading: false,
  loadingMore: false,
  cursor: null,
  dayTotals: {},
  error: null,
  summary: EMPTY_SUMMARY,
  monthlySales: 0,
  // Default: this month's POSTED bills — what the screen used to show by accident.
  // Unlike the old silent range, the control displays it and the user can change it.
  filter: { status: 'posted', ...thisMonth() },

  fetchBills: async (userId: string, filter?: BillFilter) => {
    set({ loading: true, error: null, cursor: null });
    const active = filter ?? get().filter;
    try {
      // Page 1, the headline summary and the per-day subtotals share ONE WHERE clause.
      // The summary and day totals are whole-set SQL aggregates; only the rows page.
      const [{ bills, billSummary, nextCursor }, days] = await Promise.all([
        getFilteredBills(userId, active, PAGE_SIZE),
        getBillDayTotals(userId, active),
      ]);
      set({
        bills,
        cursor: nextCursor,
        dayTotals: Object.fromEntries(days.map(d => [d.day, d])),
        summary: billSummary,
        monthlySales: billSummary.totalBilled,
        filter: active,
        loading: false,
      });
    } catch (err: any) {
      if (__DEV__) console.error('[Bill] fetch failed:', err);
      set({ error: err?.message || 'Failed to fetch bills', loading: false });
    }
  },

  // Next page only — strictly after the last loaded bill. Totals are NOT refetched.
  loadMoreBills: async (userId: string) => {
    const { cursor, loadingMore, loading, filter } = get();
    if (!cursor || loadingMore || loading) return;
    set({ loadingMore: true });
    try {
      const { bills, nextCursor } = await getFilteredBills(userId, filter, PAGE_SIZE, 0, cursor);
      set(state => ({ bills: [...state.bills, ...bills], cursor: nextCursor, loadingMore: false }));
    } catch (err: any) {
      if (__DEV__) console.error('[Bill] load more failed:', err);
      set({ loadingMore: false });
    }
  },

  setFilter: async (userId: string, filter: BillFilter) => {
    set({ filter });
    await get().fetchBills(userId, filter);
  },

  addBill: async (bill, items) => {
    try {
      const newBill = await createBill(bill, items);
      const active = get().filter;
      const inActiveFilter = billMatchesFilter(newBill, active);
      // Re-read instead of prepending: a bill dated outside the active range must
      // not appear to have saved into a view it does not belong to. The caller is
      // told so it can say where the bill actually went.
      await get().fetchBills(bill.user_id, active);
      return { bill: newBill, inActiveFilter };
    } catch (err) {
      if (__DEV__) console.error('[Bill] create failed:', err);
      throw err;
    }
  },

  updateBillRecord: async (id, userId, updates) => {
    try {
      const { updateBill } = require('../services/database/billDb');
      await updateBill(id, userId, updates);
      set(state => ({
        bills: state.bills.map(b => b.id === id ? { ...b, ...updates } : b)
      }));
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  updateBillItemRecord: async (id, billId, userId, updates) => {
    try {
      const { updateBillItem } = require('../services/database/billDb');
      await updateBillItem(id, billId, userId, updates);
      set(state => ({
        bills: state.bills.map(b => b.id === billId ? {
          ...b,
          items: (b.items || []).map(i => i.id === id ? { ...i, ...updates } : i)
        } : b)
      }));
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  /**
   * Retained so existing callers keep working. The headline now always comes from
   * the same filtered query as the list, so this is just a refresh.
   */
  loadMonthlySales: async (userId: string) => {
    await get().fetchBills(userId);
  },
}));
