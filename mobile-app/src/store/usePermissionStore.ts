import { create } from 'zustand';
import { getDatabase } from '../services/database/db';
import { User } from '../types';

interface PermissionStore {
  visibleUserIds: string[];
  subordinates: User[];
  
  computeVisibleUsers: (currentUser: User) => Promise<void>;
  canViewUser: (targetUserId: string) => boolean;
  canEditUser: (targetUserId: string, currentUser: User) => boolean;
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  visibleUserIds: [],
  subordinates: [],

  computeVisibleUsers: async (currentUser: User) => {
    try {
      const db = await getDatabase();
      const subs = await db.getAllAsync<User>(
        'SELECT * FROM users WHERE parentId = ? AND id != ?',
        [currentUser.id, currentUser.id]
      );
      
      const ids = [currentUser.id, ...subs.map(s => s.id)];
      set({ visibleUserIds: ids, subordinates: subs });
    } catch (err) {
      if (__DEV__) console.error('Failed to compute visible users', err);
      set({ visibleUserIds: [currentUser.id], subordinates: [] });
    }
  },

  canViewUser: (targetUserId: string) => {
    return get().visibleUserIds.includes(targetUserId);
  },

  canEditUser: (targetUserId: string, currentUser: User) => {
    return targetUserId === currentUser.id;
  }
}));

/** Helper to get admin chain for activity logging */
export const getAdminChainFor = async (userId: string): Promise<string[]> => {
  try {
    const db = await getDatabase();
    const user = await db.getFirstAsync<{ id: string; parentId: string | null }>(
      'SELECT id, parentId FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return [userId];

    const chain = [user.id];
    if (user.parentId) {
      chain.push(user.parentId);
      // In a deep hierarchy we'd loop here, but DigiKhata has 1 level (Admin -> Staff)
    }
    return chain;
  } catch {
    return [userId];
  }
};
