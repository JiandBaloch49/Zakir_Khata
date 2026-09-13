import NetInfo from '@react-native-community/netinfo';
import { syncAllPendingData } from './syncService';
import { IS_FIREBASE_CONFIGURED } from './firebaseConfig';

const SYNC_INTERVAL_MS = 30_000;

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isOnline = false;
let isSyncing = false;

export const initializeOfflineSync = (userId: string): void => {
  if (!IS_FIREBASE_CONFIGURED) return;

  const checkNetworkAndSync = async (): Promise<void> => {
    if (isSyncing) return;
    try {
      const networkState = await NetInfo.fetch();
      const wasOnline = isOnline;
      isOnline = networkState.isConnected === true;
      if (isOnline && !wasOnline) {
        isSyncing = true;
        try {
          await syncAllPendingData(userId);
        } finally {
          isSyncing = false;
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Error in network check:', error);
    }
  };

  checkNetworkAndSync();
  syncInterval = setInterval(checkNetworkAndSync, SYNC_INTERVAL_MS);
};

export const stopOfflineSync = (): void => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  isSyncing = false;
};

export const forceSyncNow = async (userId: string): Promise<boolean> => {
  if (!IS_FIREBASE_CONFIGURED || isSyncing) return false;
  try {
    const networkState = await NetInfo.fetch();
    if (networkState.isConnected) {
      isSyncing = true;
      try {
        await syncAllPendingData(userId);
        return true;
      } finally {
        isSyncing = false;
      }
    }
    return false;
  } catch (error) {
    if (__DEV__) console.error('Error in force sync:', error);
    return false;
  }
};

export const isNetworkAvailable = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  } catch {
    return false;
  }
};
