import { create } from 'zustand';
import { StaffRecord } from '../types/staff.types';
import { 
  getStaffRecords, 
  addStaffRecord, 
  getStaffStats 
} from '../services/database/staffDb';

interface StaffStore {
  staff: StaffRecord[];
  loading: boolean;
  error: string | null;
  stats: { total: number; active: number; inactive: number };

  fetchStaff: (userId: string) => Promise<void>;
  addStaff: (staffData: Omit<StaffRecord, 'id' | 'created_at' | 'synced' | 'is_deleted'>) => Promise<void>;
  loadStats: (userId: string) => Promise<void>;
}

export const useStaffStore = create<StaffStore>((set) => ({
  staff: [],
  loading: false,
  error: null,
  stats: { total: 0, active: 0, inactive: 0 },

  fetchStaff: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const staff = await getStaffRecords(userId);
      set({ staff, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ error: 'Failed to fetch staff', loading: false });
    }
  },

  addStaff: async (staffData) => {
    try {
      const newStaff = await addStaffRecord(staffData);
      set(state => ({ staff: [newStaff, ...state.staff] }));
    } catch (err) {
      if (__DEV__) console.error(err);
      throw err;
    }
  },

  loadStats: async (userId: string) => {
    try {
      const stats = await getStaffStats(userId);
      set({ stats });
    } catch (err) {
      if (__DEV__) console.error(err);
    }
  }
}));
