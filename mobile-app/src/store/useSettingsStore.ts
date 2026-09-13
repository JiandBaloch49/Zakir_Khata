import { create } from 'zustand';
import { getDatabase } from '../services/database/db';

type DisplayMode = 'en' | 'ur' | 'both';

interface SettingsStore {
  nameDisplayMode: DisplayMode;
  loading: boolean;
  
  loadSettings: (userId: string) => Promise<void>;
  setNameDisplayMode: (userId: string, mode: DisplayMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  nameDisplayMode: 'en',
  loading: false,

  loadSettings: async (userId: string) => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ name_display_mode: DisplayMode }>(
        'SELECT name_display_mode FROM user_settings WHERE user_id = ?',
        [userId]
      );
      if (result) {
        set({ nameDisplayMode: result.name_display_mode });
      } else {
        // Create default if missing
        await db.runAsync(
          'INSERT INTO user_settings (user_id, name_display_mode, updated_at) VALUES (?, ?, ?)',
          [userId, 'en', new Date().toISOString()]
        );
        set({ nameDisplayMode: 'en' });
      }
    } catch (err) {
      if (__DEV__) console.error('Failed to load settings:', err);
    } finally {
      set({ loading: false });
    }
  },

  setNameDisplayMode: async (userId: string, mode: DisplayMode) => {
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO user_settings (user_id, name_display_mode, updated_at) 
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET 
         name_display_mode=excluded.name_display_mode, updated_at=excluded.updated_at`,
        [userId, mode, now]
      );
      set({ nameDisplayMode: mode });
    } catch (err) {
      if (__DEV__) console.error('Failed to save settings:', err);
    }
  }
}));
