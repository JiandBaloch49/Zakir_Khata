import { useLanguageStore } from '../store/useLanguageStore';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { StaffNavigator } from './StaffNavigator';
import { AdminNavigator } from './AdminNavigator';
import { getDatabase } from '../services/database/db';
import { seedDatabase, seedTestUsers } from '../services/database/seedData';
import { initializeOfflineSync, stopOfflineSync } from '../services/firebase/offlineSync';
import { IS_FIREBASE_CONFIGURED } from '../services/firebase/firebaseConfig';
import { themeColors } from '../theme/theme';
import { AmbientBackground } from '../components/AmbientBackground';

const darkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: themeColors.background,
    card: themeColors.cardBg,
    text: themeColors.textPrimary,
    border: themeColors.border,
    primary: themeColors.primary,
  },
};

export const AppNavigator = () => {
  const { t, isLoaded, loadLanguage } = useLanguageStore();
  const { isAuthenticated, user, checkSession, loading } = useAuthStore();
  const [showFirebaseWarning, setShowFirebaseWarning] = useState(!IS_FIREBASE_CONFIGURED);

  useEffect(() => {
    const boot = async () => {
      console.log('[DB] Starting database initialization...');
      try {
        await loadLanguage();
        const db = await getDatabase();
        console.log('[DB] Database ready.');
        
        await seedTestUsers();
        console.log('[DB] Seed users complete.');
        
        await seedDatabase();
        console.log('[DB] Seed database complete.');
        
        await checkSession();
        console.log('[Auth] Check session complete.');
      } catch (error) {
        console.error('[DB] Initialization failed:', error);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      initializeOfflineSync(user.id);
    }
    return () => { stopOfflineSync(); };
  }, [isAuthenticated, user?.id]);

  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: themeColors.background }}><ActivityIndicator color={themeColors.primary} /></View>;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ color: themeColors.textSecondary, marginTop: 12, fontSize: 16 }}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <AmbientBackground>
      <NavigationContainer theme={darkNavigationTheme}>
        {showFirebaseWarning && (
          <View style={{ backgroundColor: '#2c2200', borderBottomWidth: 1, borderColor: '#7c5e00', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#ffd000', fontSize: 12, flex: 1 }}>
              {t('cloudDisabled')}
            </Text>
            <TouchableOpacity onPress={() => setShowFirebaseWarning(false)}>
              <Text style={{ color: '#ffd000', fontWeight: 'bold', marginLeft: 8 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isAuthenticated ? (
          <AuthNavigator />
        ) : user?.role === 'admin' ? (
          <AdminNavigator />
        ) : (
          <StaffNavigator />
        )}
      </NavigationContainer>
    </AmbientBackground>
  );
};
