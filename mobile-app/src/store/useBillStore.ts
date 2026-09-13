import { create } from 'zustand';
import { Bill, BillItem } from '../types/bill.types';
import { localDate } from '../utils/dates';
import {
  getFilteredBills,
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
  bills: Bill[];
  loading: boolean;
  error: string | null;
  /** SQL aggregates over the WHOLE filtered set — never a sum of the loaded page. */
  summary: BillSummary;
  /** Alias of summary.totalBilled, kept so existing callers read the filtered figure. */
  monthlySales: number;
  filter: BillFilter;

  fetchBills: (userId: string, filter?: BillFilter) => Promise<void>;
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
  error: null,
  summary: EMPTY_SUMMARY,
  monthlySales: 0,
  // Default: this month's POSTED bills — what the screen used to show by accident.
  // Unlike the old silent range, the control displays it and the user can change it.
  filter: { status: 'posted', ...thisMonth() },

  fetchBills: async (userId: string, filter?: BillFilter) => {
    set({ loading: true, error: null });
    const active = filter ?? get().filter;
    try {
      // List and every headline figure come from ONE call sharing ONE WHERE clause.
      const { bills, billSummary } = await getFilteredBills(userId, active);
      set({
        bills,
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
