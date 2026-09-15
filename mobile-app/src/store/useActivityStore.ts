import { create } from 'zustand';
import { ActivityLog } from '../types/activity.types';
import { getActivities, logActivityRecord } from '../services/database/activityDb';
import { PAGE_SIZE, PageCursor } from '../services/database/pagination';
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
  loadingMore: boolean;
  /** Cursor for the next page; null once the oldest activity is loaded. */
  cursor: PageCursor | null;

  fetchActivities: (adminId: string) => Promise<void>;
  loadMoreActivities: (adminId: string) => Promise<void>;
  logActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp' | 'visible_to'>) => Promise<void>;
  setFilters: (filters: Partial<ActivityStore['filters']>) => void;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  filters: {},
  loading: false,
  loadingMore: false,
  cursor: null,

  fetchActivities: async (adminId: string) => {
    set({ loading: true, cursor: null });
    try {
      const { rows, nextCursor } = await getActivities(adminId, get().filters, PAGE_SIZE);
      set({ activities: rows, cursor: nextCursor, loading: false });
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ loading: false });
    }
  },

  // Older activity, strictly after the last loaded row — the hard LIMIT 100 is gone.
  loadMoreActivities: async (adminId: string) => {
    const { cursor, loadingMore, loading } = get();
    if (!cursor || loadingMore || loading) return;
    set({ loadingMore: true });
    try {
      const { rows, nextCursor } = await getActivities(adminId, get().filters, PAGE_SIZE, cursor);
      set(state => ({ activities: [...state.activities, ...rows], cursor: nextCursor, loadingMore: false }));
    } catch (err) {
      if (__DEV__) console.error(err);
      set({ loadingMore: false });
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
