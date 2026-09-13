import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { themeColors } from '../theme/theme';

interface Props {
  navigation: any;
  activeBook?: string;
}

export const TopHeaderWithBooks: React.FC<Props> = ({ navigation, activeBook }) => {
  const user = useAuthStore(state => state.user);
  const { t } = useLanguageStore();

  const books = [
    { name: 'CashBook', label: t('cashBook'), icon: '💰', color: 'rgba(0, 166, 81, 0.2)', activeColor: '#00A651' },
    { name: 'StockBook', label: t('stockBook'), icon: '📦', color: 'rgba(9, 132, 227, 0.2)', activeColor: '#0984e3' },
    { name: 'BillBook', label: t('billBook'), icon: '📃', color: 'rgba(253, 203, 110, 0.2)', activeColor: '#f1c40f' },
    { name: 'StaffBook', label: t('staffBook'), icon: '👥', color: 'rgba(108, 92, 231, 0.2)', activeColor: '#6c5ce7' },
    { name: 'ExpensesTab', label: t('expenseBook'), icon: '💸', color: 'rgba(238, 90, 111, 0.2)', activeColor: '#ee5a6f' },
    { name: 'PurchaseBook', label: t('purchaseBook'), icon: '🛒', color: 'rgba(225, 112, 85, 0.2)', activeColor: '#e17055' },
    { name: 'CustomerBook', label: t('customerBook'), icon: '👤', color: 'rgba(0, 210, 211, 0.2)', activeColor: '#00d2d3' },
  ];

  return (
    <View style={styles.headerContainer}>
      {/* Top User Profile Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.navigate('More')} style={styles.profileBox} activeOpacity={0.8}>
          {user?.pictureUrl ? (
            <Image source={{ uri: user.pictureUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
          )}
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.welcomeText}>{t('welcome')},</Text>
            <Text style={styles.userName}>{user?.name || t('user')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightBtns}>
          <TouchableOpacity
            onPress={() => navigation.navigate('RemindersCenter')}
            style={styles.glassCircleBtn}
          >
            <Text style={styles.glassBtnIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Books Bar (Horizontal Scrollable Row without "My Books" text) */}
      <View style={{ marginTop: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {books.map(b => {
            const isActive = activeBook === b.name;
            return (
              <TouchableOpacity
                key={b.name}
                style={[styles.headerBookCard, isActive && styles.headerBookCardActive]}
                onPress={() => navigation.navigate(b.name)}
                activeOpacity={0.8}
              >
                <View style={[styles.headerBookIconCircle, { backgroundColor: b.color }, isActive && { backgroundColor: b.activeColor }]}>
                  <Text style={{ fontSize: 18 }}>{b.icon}</Text>
                </View>
                <Text style={[styles.headerBookText, isActive && styles.headerBookTextActive]} numberOfLines={2}>{b.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: themeColors.cardBg,
    paddingHorizontal: 14,
    paddingTop: 44,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileBox: { flexDirection: 'row', alignItems: 'center' },
  welcomeText: { color: themeColors.textSecondary, fontSize: 11, fontWeight: '500' },
  userName: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 1 },

  avatarImg: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#1dd1a1' },
  avatarPlaceholder: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: themeColors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  headerRightBtns: { flexDirection: 'row', gap: 8 },
  glassCircleBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassBtnIcon: { fontSize: 15 },

  headerBookCard: {
    width: 74,
    backgroundColor: themeColors.inputBg,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: themeColors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBookCardActive: {
    borderColor: '#1dd1a1',
    backgroundColor: 'rgba(29, 209, 161, 0.15)',
  },
  headerBookIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerBookText: {
    color: themeColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerBookTextActive: {
    color: '#1dd1a1',
    fontWeight: '800',
  },
});
