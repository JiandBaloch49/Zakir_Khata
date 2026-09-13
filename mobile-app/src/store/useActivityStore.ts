import { create } from 'zustand';
import { ActivityLog } from '../types/activity.types';
import { getActivities, logActivityRecord } from '../services/database/activityDb';
import { getAdminChainFor } from './usePermissionStore';

interface ActivityStore {
  activities: ActivityLog[];
  filters: {
    staffId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  };
  loading: boolean;
  
  fetchActivities: (adminId: string) => Promise<void>;
  logActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp' | 'visible_to'>) => Promise<void>;
  setFilters: (filters: Partial<ActivityStore['filters']>) => void;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  filters: {},
  loading: false,

  fetchActivities: async (adminId: string) => {
    set({ loading: true });
    try {
      const logs = await getActivities(adminId, get().filters);
      set({ activities: logs, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ loading: false });
    }
  },

  logActivity: async (activity) => {
    try {
      const visible_to = await getAdminChainFor(activity.user_id);
      await logActivityRecord({ ...activity, visible_to });
    } catch (err) {
      if (__DEV__) console.error('Failed to log activity', err);
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  }
}));
