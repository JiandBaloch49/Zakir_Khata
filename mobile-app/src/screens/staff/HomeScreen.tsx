import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { formatCurrency, formatDate } from '../../utils/calculations';
import { ActivityLog } from '../../types/activity.types';
import { themeColors } from '../../theme/theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';

export const HomeScreen = ({ navigation }: any) => {
  const user = useAuthStore(state => state.user);
  const t = useLanguageStore(state => state.t);
  const metrics = useDashboardStore(state => state.metrics);
  const recentActivities = useDashboardStore(state => state.recentActivities);
  const loading = useDashboardStore(state => state.loading);
  const refreshDashboard = useDashboardStore(state => state.refreshDashboard);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refreshDashboard(user.id);
      }
    }, [user?.id])
  );

  const MetricCard = ({ title, amount, icon, subtitle }: any) => (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={styles.metricTitle}>{title}</Text>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={styles.metricAmount} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
      {subtitle && <Text style={styles.metricSub}>{subtitle}</Text>}
    </View>
  );

  const ActionButton = ({ icon, label, onPress }: any) => (
    <TouchableOpacity onPress={onPress} style={styles.actionBtn} activeOpacity={0.8}>
      <LinearGradient
        colors={['#00A651', '#1dd1a1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionIconCircle}
      >
        <Text style={{ fontSize: 20, color: '#fff' }}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );

  const renderActivityItem = ({ item }: { item: ActivityLog }) => (
    <View style={styles.activityRow}>
      <View style={styles.activityIconCircle}>
        <Text style={{ fontSize: 16 }}>
          {item.entity_type === 'bill' ? '📃' : item.entity_type === 'cash' ? '💵' : item.entity_type === 'expense' ? '💸' : '📝'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityAction}>{item.action}</Text>
        <Text style={styles.activityDesc}>{item.description}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {item.amount ? (
          <Text style={styles.activityAmount}>{formatCurrency(item.amount)}</Text>
        ) : null}
        <Text style={styles.activityTime}>{formatDate(item.timestamp)}</Text>
      </View>
    </View>
  );

  if (loading && metrics.todaySales === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1dd1a1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>

        {/* Global Search Bar */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('GlobalSearch')}
          style={styles.searchBar}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search customers, bills, products...</Text>
        </TouchableOpacity>

        {/* Main Cash Balance Hero Card */}
        <LinearGradient
          colors={['#1a2432', '#121822']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBalanceCard}
        >
          <Text style={styles.heroBalanceLabel}>Cash Balance</Text>
          <Text style={styles.heroBalanceAmount}>{formatCurrency(metrics.cashInDrawer || 0)}</Text>
        </LinearGradient>

        {/* Metrics Grid */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.quickServicesTitle}>Business Metrics</Text>

          <View style={styles.metricsRow}>
            <MetricCard 
              title="Today's Sales" 
              amount={formatCurrency(metrics.todaySales)} 
              icon="📈" 
              subtitle={`${metrics.billsCreatedToday} Bills`}
            />
            <MetricCard 
              title="Today's Expenses" 
              amount={formatCurrency(metrics.todayExpenses)} 
              icon="📉" 
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard 
              title="Cash in Drawer" 
              amount={formatCurrency(metrics.cashInDrawer)} 
              icon="💵" 
            />
            <MetricCard 
              title="Monthly Profit" 
              amount={formatCurrency(metrics.monthlyProfit)} 
              icon="💰" 
              subtitle="Est. this month"
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard 
              title="Total Lena" 
              amount={formatCurrency(metrics.totalLena)} 
              icon="🟢" 
              subtitle="To Receive"
            />
            <MetricCard 
              title="Total Dena" 
              amount={formatCurrency(metrics.totalDena)} 
              icon="🔴" 
              subtitle="To Pay"
            />
          </View>
        </View>

        {/* Quick Actions Scroll Bar */}
        <View style={styles.quickCardSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}>
            <ActionButton 
              icon="📃" label="Add Bill"
              onPress={() => navigation.navigate('CreateNewBillModal')} 
            />
            <ActionButton 
              icon="📘" label="Khata Entry"
              onPress={() => navigation.navigate('AddTransaction')} 
            />
            <ActionButton 
              icon="📊" label="Reports"
              onPress={() => navigation.navigate('ReportsMenu')} 
            />
            <ActionButton 
              icon="🔔" label="Reminders"
              onPress={() => navigation.navigate('RemindersCenter')} 
            />
            <ActionButton 
              icon="🔄" label="Sync"
              onPress={() => navigation.navigate('SyncCenter')} 
            />
          </ScrollView>
        </View>

        {/* Business Alerts */}
        {(metrics.lowStockAlerts > 0 || metrics.pendingPayments > 0) && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Business Alerts</Text>
            
            {metrics.lowStockAlerts > 0 && (
              <TouchableOpacity 
                onPress={() => navigation.navigate('StockBook')}
                style={styles.alertCardRed}
                activeOpacity={0.8}
              >
                <View style={styles.alertIconBgRed}>
                  <Text style={{ fontSize: 18 }}>⚠️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitleRed}>Low Stock Alert</Text>
                  <Text style={styles.alertSubRed}>{metrics.lowStockAlerts} items need restocking</Text>
                </View>
                <Text style={styles.alertArrowRed}>›</Text>
              </TouchableOpacity>
            )}

            {metrics.pendingPayments > 0 && (
              <TouchableOpacity 
                onPress={() => navigation.navigate('BillBook')}
                style={styles.alertCardAmber}
                activeOpacity={0.8}
              >
                <View style={styles.alertIconBgAmber}>
                  <Text style={{ fontSize: 18 }}>⏳</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitleAmber}>Pending Payments</Text>
                  <Text style={styles.alertSubAmber}>{formatCurrency(metrics.pendingPayments)} unpaid bills</Text>
                </View>
                <Text style={styles.alertArrowAmber}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Recent Activity Card */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => refreshDashboard(user!.id)}>
              <Text style={styles.refreshText}>REFRESH 🔄</Text>
            </TouchableOpacity>
          </View>
          
          {recentActivities.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 13 }}>No recent activity found.</Text>
            </View>
          ) : (
            <FlatList
              data={recentActivities}
              keyExtractor={item => item.id}
              renderItem={renderActivityItem}
              scrollEnabled={false}
            />
          )}
          <TouchableOpacity onPress={() => navigation.navigate('ActivityLog')} style={{ paddingTop: 12 }}>
            <Text style={styles.refreshText}>View full activity log</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },
  loadingContainer: { flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    backgroundColor: themeColors.cardBg,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileBox: { flexDirection: 'row', alignItems: 'center' },
  welcomeText: { color: themeColors.textSecondary, fontSize: 12, fontWeight: '500' },
  userName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#1dd1a1' },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: themeColors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  headerRightBtns: { flexDirection: 'row', gap: 10 },
  glassCircleBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassBtnIcon: { fontSize: 16 },

  scroll: { flex: 1 },

  searchBar: {
    backgroundColor: themeColors.cardBg,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: themeColors.border,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  searchPlaceholder: { color: themeColors.textSecondary, fontSize: 14, fontWeight: '500' },

  heroBalanceCard: {
    borderRadius: 22, padding: 22, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  heroBalanceLabel: { color: themeColors.textSecondary, fontSize: 13, fontWeight: '600' },
  heroBalanceAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginVertical: 8, letterSpacing: 0.5 },
  
  pillRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  heroPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroPillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  heroPillText: { color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' },
  heroPillTextActive: { color: '#0B1015', fontSize: 12, fontWeight: '800' },

  quickServicesTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  
  meshGrid: { flexDirection: 'row', gap: 12 },
  meshCard: {
    borderRadius: 22, padding: 18, minHeight: 130,
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  purpleShadow: { shadowColor: '#6c5ce7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  emeraldShadow: { shadowColor: '#00A651', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  blueShadow: { shadowColor: '#0984e3', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  
  frostedIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  meshCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 16 },
  
  meshCardWide: {
    borderRadius: 22, padding: 20, minHeight: 90,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  meshCardTitleLg: { color: '#fff', fontSize: 18, fontWeight: '800' },

  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: {
    flex: 1, backgroundColor: themeColors.cardBg, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metricTitle: { color: themeColors.textSecondary, fontSize: 12, fontWeight: '600' },
  metricAmount: { color: '#fff', fontSize: 18, fontWeight: '800' },
  metricSub: { color: themeColors.textMuted, fontSize: 10, marginTop: 2 },

  quickCardSection: {
    backgroundColor: themeColors.cardBg, borderRadius: 16,
    padding: 16, marginTop: 16, marginBottom: 16,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  
  actionBtn: { alignItems: 'center', width: 64 },
  actionIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5,
  },
  actionLabel: { color: themeColors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },

  alertCardRed: {
    backgroundColor: '#2c1216', borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: '#5c2229',
  },
  alertIconBgRed: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4a191f', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTitleRed: { color: '#ee5a6f', fontWeight: '800', fontSize: 14 },
  alertSubRed: { color: '#f87171', fontSize: 12, marginTop: 1 },
  alertArrowRed: { color: '#ee5a6f', fontSize: 20, fontWeight: '800' },

  alertCardAmber: {
    backgroundColor: '#2b1c03', borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#543605',
  },
  alertIconBgAmber: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#422a05', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTitleAmber: { color: '#fbbf24', fontWeight: '800', fontSize: 14 },
  alertSubAmber: { color: '#fcd34d', fontSize: 12, marginTop: 1 },
  alertArrowAmber: { color: '#fbbf24', fontSize: 20, fontWeight: '800' },

  recentSection: {
    backgroundColor: themeColors.cardBg, borderRadius: 20,
    padding: 18, marginTop: 16, marginBottom: 24,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refreshText: { color: '#1dd1a1', fontSize: 11, fontWeight: '700' },

  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border,
  },
  activityIconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: themeColors.inputBg,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 1, borderColor: themeColors.borderLight,
  },
  activityAction: { color: '#fff', fontSize: 14, fontWeight: '600' },
  activityDesc: { color: themeColors.textSecondary, fontSize: 12, marginTop: 2 },
  activityAmount: { color: '#fff', fontSize: 14, fontWeight: '800' },
  activityTime: { color: themeColors.textMuted, fontSize: 10, marginTop: 2 },

  headerBookCard: {
    width: 88,
    backgroundColor: themeColors.cardBg,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: themeColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  headerBookIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerBookText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
