import { create } from 'zustand';
import { SyncStore } from '../types/sync.types';
import { processSyncQueue, batchProcessSyncQueue } from '../services/syncProcessor';
import { pullRemoteChanges } from '../services/pullSyncService';

export const useSyncStore = create<SyncStore>((set, get) => ({
  isOnline: true,
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null,
  isSyncing: false,

  setOnlineStatus: (status: boolean) => set({ isOnline: status }),
  
  setPendingCount: (count: number) => set({ pendingCount: count }),
  
  incrementPendingCount: () => set((state) => ({ pendingCount: state.pendingCount + 1 })),

  processSyncQueue: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    try {
      await processSyncQueue();
    } finally {
      set({ isSyncing: false });
    }
  },

  batchProcessSyncQueue: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    try {
      await batchProcessSyncQueue();
    } finally {
      set({ isSyncing: false });
    }
  },

  pullRemoteChanges: async (userId: string) => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    try {
      await pullRemoteChanges(userId);
    } finally {
      set({ isSyncing: false });
    }
  },

  retryFailedItems: async () => {
    // handled inside processSyncQueue usually, but can be explicit
    await get().processSyncQueue();
  },

  getFailedItems: async () => {
    // placeholder, real implementation accesses SQLite
    return [];
  }
}));
