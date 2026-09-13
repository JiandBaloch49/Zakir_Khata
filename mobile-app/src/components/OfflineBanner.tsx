import { useLanguageStore } from '../store/useLanguageStore';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSyncStore } from '../store/useSyncStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const OfflineBanner = () => {
  const { t } = useLanguageStore();
  const isOnline = useSyncStore(state => state.isOnline);
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <Text style={styles.text}>{t('offlineBanner')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2b1c03',
    borderBottomWidth: 1,
    borderColor: '#543605',
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  text: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  }
});
