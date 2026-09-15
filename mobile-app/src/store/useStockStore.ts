import { create } from 'zustand';
import { PAGE_SIZE, PageCursor } from '../services/database/pagination';
import { StockItem, StockMovement } from '../types/stock.types';
import { 
  getStockItemsByUserId, 
  createStockItem, 
  deleteStockItem, 
  calculateTotalStockValue,
  addStockMovement,
  getMovementsByItemId,
  getStockMovementReport,
  getStockMovementDayTotals,
  StockMovementFilter,
  StockMovementSummary,
  StockMovementDayTotal,
  StockReportEntry
} from '../services/database/stockDb';

interface StockStore {
  items: StockItem[];
  movements: StockMovement[];
  selectedTab: 'all' | 'low';
  loading: boolean;
  error: string | null;
  totalStockValue: number;
  
  /** Stock IN / OUT report state: paged rows, whole-set SQL summary, per-day SQL subtotals. */
  movementReport: Record<'in' | 'out', MovementReportState>;

  fetchItems: (userId: string) => Promise<void>;
  fetchLowStockItems: (userId: string) => Promise<void>;
  addItem: (item: Omit<StockItem, 'id' | 'created_at' | 'synced' | 'is_deleted' | 'quantity'>) => Promise<void>;
  removeItem: (id: string, userId: string) => Promise<void>;
  setSelectedTab: (tab: 'all' | 'low') => void;
  loadStockValue: (userId: string) => Promise<void>;
  recordMovement: (movement: Omit<StockMovement, 'id' | 'synced' | 'is_deleted'>) => Promise<StockMovement>;
  fetchMovements: (itemId: string) => Promise<void>;
  fetchMovementReport: (userId: string, direction: 'in' | 'out', filter: StockMovementFilter) => Promise<void>;
  loadMoreMovementReport: (userId: string, direction: 'in' | 'out') => Promise<void>;
}

export type MovementReportState = {
  rows: StockReportEntry[];
  summary: StockMovementSummary;
  dayTotals: Record<string, StockMovementDayTotal>;
  cursor: PageCursor | null;
  filter: StockMovementFilter;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};
const EMPTY_REPORT: MovementReportState = {
  rows: [], summary: { entries: 0, qty: 0, amount: 0 }, dayTotals: {}, cursor: null, filter: {}, loading: false, loadingMore: false, error: null,
};

export const useStockStore = create<StockStore>((set, get) => ({
  items: [],
  movements: [],
  selectedTab: 'all',
  loading: false,
  error: null,
  totalStockValue: 0,
  movementReport: { in: EMPTY_REPORT, out: EMPTY_REPORT },

  fetchItems: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const items = await getStockItemsByUserId(userId, false);
      set({ items, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ error: 'Failed to fetch stock items', loading: false });
    }
  },

  fetchLowStockItems: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const items = await getStockItemsByUserId(userId, true);
      set({ items, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ error: 'Failed to fetch low stock items', loading: false });
    }
  },

  addItem: async (item) => {
    try {
      const newItem = await createStockItem(item);
      set(state => ({ items: [newItem, ...state.items] }));
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  removeItem: async (id: string, userId: string) => {
    try {
      await deleteStockItem(id, userId);
      const isLowTab = get().selectedTab === 'low';
      const items = await getStockItemsByUserId(userId, isLowTab);
      set({ items });
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  setSelectedTab: (tab: 'all' | 'low') => set({ selectedTab: tab }),

  loadStockValue: async (userId: string) => {
    try {
      const value = await calculateTotalStockValue(userId);
      set({ totalStockValue: value });
    } catch (err) {
      if (__DEV__) console.error(err);
    }
  },

  recordMovement: async (movement) => {
    try {
      const result = await addStockMovement(movement);
      // Refresh items so quantities are up to date
      const items = await getStockItemsByUserId(movement.user_id, false);
      set({ items });
      return result;
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  fetchMovements: async (itemId: string) => {
    try {
      const movements = await getMovementsByItemId(itemId);
      set({ movements });
    } catch (err) {
      if (__DEV__) console.error(err);
    }
  },

  // Page 1 + whole-set summary + per-day subtotals, all from ONE predicate.
  fetchMovementReport: async (userId, direction, filter) => {
    set(s => ({ movementReport: { ...s.movementReport, [direction]: { ...s.movementReport[direction], loading: true, error: null, filter, cursor: null } } }));
    try {
      const [{ rows, summary, nextCursor }, days] = await Promise.all([
        getStockMovementReport(userId, direction, filter.startDate, filter.endDate, PAGE_SIZE, null, filter.search),
        getStockMovementDayTotals(userId, direction, filter.startDate, filter.endDate, filter.search),
      ]);
      set(s => ({ movementReport: { ...s.movementReport, [direction]: {
        rows, summary, cursor: nextCursor, filter, dayTotals: Object.fromEntries(days.map(d => [d.day, d])), loading: false, loadingMore: false, error: null,
      } } }));
    } catch (err: any) {
      if (__DEV__) console.error(err);
      set(s => ({ movementReport: { ...s.movementReport, [direction]: { ...s.movementReport[direction], loading: false, error: err?.message || 'Failed to fetch report' } } }));
    }
  },

  // Next page only — strictly after the last loaded movement. Totals are NOT refetched.
  loadMoreMovementReport: async (userId, direction) => {
    const cur = get().movementReport[direction];
    if (!cur.cursor || cur.loadingMore || cur.loading) return;
    set(s => ({ movementReport: { ...s.movementReport, [direction]: { ...cur, loadingMore: true } } }));
    try {
      const { rows, nextCursor } = await getStockMovementReport(userId, direction, cur.filter.startDate, cur.filter.endDate, PAGE_SIZE, cur.cursor, cur.filter.search);
      set(s => { const now = s.movementReport[direction]; return { movementReport: { ...s.movementReport, [direction]: { ...now, rows: [...now.rows, ...rows], cursor: nextCursor, loadingMore: false } } }; });
    } catch (err) {
      if (__DEV__) console.error(err);
      set(s => ({ movementReport: { ...s.movementReport, [direction]: { ...s.movementReport[direction], loadingMore: false } } }));
    }
  }
}));
