import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../store/useSyncStore';

let unsubscribe: (() => void) | null = null;

export function initConnectivityListener() {
  if (unsubscribe) return unsubscribe;
  
  unsubscribe = NetInfo.addEventListener(state => {
    const isOnline = !!(state.isConnected && state.isInternetReachable);
    const store = useSyncStore.getState();
    const wasOffline = !store.isOnline;
    
    store.setOnlineStatus(isOnline);
    
    if (isOnline && wasOffline) {
      // Connectivity just restored — trigger sync
      store.processSyncQueue();
    }
  });

  return unsubscribe;
}
