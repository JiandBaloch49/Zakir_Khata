import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { verifyUserLogin, updateUser } from '../services/database/userDb';
import { User, AuthState } from '../types';

const AUTH_KEY = 'auth_session';
const RATE_KEY = 'login_attempts';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days


interface AuthStore extends AuthState {
  loading: boolean;
  login: (phone: string, password: string) => Promise<'ok' | 'invalid' | 'locked'>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  updateProfilePicture: (userId: string, uri: string) => Promise<void>;
}



async function buildSession(user: User): Promise<AuthState> {
  return {
    user,
    isAuthenticated: true,
    token: Crypto.randomUUID(),
    issuedAt: Date.now(),
  };
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  issuedAt: null,
  loading: false,

  login: async (phone, password) => {
    set({ loading: true });
    try {
      const user = await verifyUserLogin(phone, password);
      if (!user) {
        if (__DEV__) console.warn('[Auth] Login failed — invalid credentials.');
        return 'invalid';
      }

      const authData = await buildSession(user);
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(authData));
      set(authData);
      return 'ok';
    } catch (err) {
      if (__DEV__) console.error('[Auth] Login threw an unexpected error:', err);
      return 'invalid';
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(AUTH_KEY);
    } catch {}
    set({ user: null, isAuthenticated: false, token: null, issuedAt: null });
  },

  checkSession: async () => {
    try {
      const raw = await SecureStore.getItemAsync(AUTH_KEY);
      if (!raw) return;
      const authData = JSON.parse(raw) as AuthState;
      if (
        !authData.issuedAt ||
        !authData.user ||
        !authData.isAuthenticated ||
        Date.now() - authData.issuedAt > SESSION_TTL_MS
      ) {
        if (__DEV__) console.warn('[Auth] Session expired or invalid, clearing.');
        await SecureStore.deleteItemAsync(AUTH_KEY);
        return;
      }
      set(authData);
    } catch (err) {
      // corrupted session — clear it
      if (__DEV__) console.error('[Auth] Failed to restore session:', err);
      try { await SecureStore.deleteItemAsync(AUTH_KEY); } catch {}
    }
  },

  updateProfilePicture: async (userId, uri) => {
    try {
      // 1. Persist to SQLite
      await updateUser(userId, { pictureUrl: uri });
      // 2. Patch in-memory user state immediately
      set(state => ({
        user: state.user ? { ...state.user, pictureUrl: uri } : state.user,
      }));
      // 3. Re-save patched session to SecureStore so it survives app restart
      const raw = await SecureStore.getItemAsync(AUTH_KEY);
      if (raw) {
        const session = JSON.parse(raw) as AuthState;
        if (session.user) {
          session.user.pictureUrl = uri;
          await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(session));
        }
      }
    } catch (err) {
      if (__DEV__) console.error('[Auth] Failed to update profile picture:', err);
    }
  },
}));
