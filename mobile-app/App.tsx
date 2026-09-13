import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initConnectivityListener } from './src/services/connectivityService';
import { OfflineBanner } from './src/components/OfflineBanner';

export default function App() {
  React.useEffect(() => {
    const unsubscribe = initConnectivityListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B1015' }}>
      <SafeAreaProvider>
        <OfflineBanner />
        <StatusBar style="light" backgroundColor="#0B1015" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

