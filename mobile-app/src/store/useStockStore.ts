import { create } from 'zustand';
import { StockItem, StockMovement } from '../types/stock.types';
import { 
  getStockItemsByUserId, 
  createStockItem, 
  deleteStockItem, 
  calculateTotalStockValue,
  addStockMovement,
  getMovementsByItemId,
  getStockInReport,
  getStockOutReport,
  StockReportEntry
} from '../services/database/stockDb';

interface StockStore {
  items: StockItem[];
  movements: StockMovement[];
  selectedTab: 'all' | 'low';
  loading: boolean;
  error: string | null;
  totalStockValue: number;
  
  inReports: StockReportEntry[];
  outReports: StockReportEntry[];

  fetchItems: (userId: string) => Promise<void>;
  fetchLowStockItems: (userId: string) => Promise<void>;
  addItem: (item: Omit<StockItem, 'id' | 'created_at' | 'synced' | 'is_deleted' | 'quantity'>) => Promise<void>;
  removeItem: (id: string, userId: string) => Promise<void>;
  setSelectedTab: (tab: 'all' | 'low') => void;
  loadStockValue: (userId: string) => Promise<void>;
  recordMovement: (movement: Omit<StockMovement, 'id' | 'synced' | 'is_deleted'>) => Promise<StockMovement>;
  fetchMovements: (itemId: string) => Promise<void>;
  fetchInReports: (userId: string, startDate?: string, endDate?: string) => Promise<void>;
  fetchOutReports: (userId: string, startDate?: string, endDate?: string) => Promise<void>;
}

export const useStockStore = create<StockStore>((set, get) => ({
  items: [],
  movements: [],
  selectedTab: 'all',
  loading: false,
  error: null,
  totalStockValue: 0,
  inReports: [],
  outReports: [],

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

  fetchInReports: async (userId: string, startDate?: string, endDate?: string) => {
    set({ loading: true, error: null });
    try {
      const reports = await getStockInReport(userId, startDate, endDate);
      set({ inReports: reports, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ error: 'Failed to fetch IN reports', loading: false });
    }
  },

  fetchOutReports: async (userId: string, startDate?: string, endDate?: string) => {
    set({ loading: true, error: null });
    try {
      const reports = await getStockOutReport(userId, startDate, endDate);
      set({ outReports: reports, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ error: 'Failed to fetch OUT reports', loading: false });
    }
  }
}));
