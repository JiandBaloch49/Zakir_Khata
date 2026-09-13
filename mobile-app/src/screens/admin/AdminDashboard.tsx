import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { getUsersInScope, ScopedUser } from '../../services/database/userDb';
import { getAllStaffMetricsAggregate } from '../../services/database/transactionDb';
import { User } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { useDashboardStore } from '../../store/useDashboardStore';
import { themeColors } from '../../theme/theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';

export const AdminDashboard = ({ navigation }: any) => {
  const user = useAuthStore(state => state.user);
  const metrics = useDashboardStore(state => state.metrics);
  const refreshDashboard = useDashboardStore(state => state.refreshDashboard);
  
  const [staffList, setStaffList] = useState<ScopedUser[]>([]);
  const [staffMetricsMap, setStaffMetricsMap] = useState<Record<string, { totalLena: number; totalDena: number; netBalance: number }>>({});

  useEffect(() => {
    if (user) {
      loadStaffData();
      refreshDashboard(user.id);
    }
  }, [user]);

  const loadStaffData = async () => {
    if (!user) return;
    try {
      const users = await getUsersInScope(user.id);
      const staffUsers = users.filter(u => u.role === 'staff');
      setStaffList(staffUsers);

      const metricsMap = await getAllStaffMetricsAggregate(user.id);
      setStaffMetricsMap(metricsMap);
    } catch (error) {
      if (__DEV__) console.error('Error loading staff:', error);
    }
  };

  const handleStaffPress = (staff: User) => {
    navigation.navigate('StaffDetail', { staff });
  };

  const renderStaffItem = ({ item }: { item: ScopedUser }) => {
    const stMetrics = staffMetricsMap[item.id] || { totalLena: 0, totalDena: 0, netBalance: 0 };
    
    return (
      <TouchableOpacity
        onPress={() => handleStaffPress(item)}
        style={styles.staffCard}
        activeOpacity={0.7}
      >
        <View style={styles.staffRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffName}>{item.name}</Text>
            <Text style={styles.staffPhone}>{item.phone}</Text>
            <Text style={styles.staffBiz}>{item.businessName || 'No business name'}</Text>
            {item.account_level === 'substaff' && !!item.parentName && (
              <Text style={styles.staffBiz}>Sub-staff of {item.parentName}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.textGreen}>
              Lena: {formatCurrency(stMetrics.totalLena)}
            </Text>
            <Text style={styles.textRed}>
              Dena: {formatCurrency(stMetrics.totalDena)}
            </Text>
            <Text style={[styles.netBalanceText, stMetrics.netBalance >= 0 ? styles.textGreen : styles.textRed]}>
              Net: {formatCurrency(stMetrics.netBalance)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const netBalance = metrics.totalLena - metrics.totalDena;

  return (
    <View style={styles.container}>
      {/* Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 }}>

        {/* Global Search Bar */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('GlobalSearch')}
          style={styles.searchBar}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search customers, bills, products...</Text>
        </TouchableOpacity>

        {/* Balance Card with Gradient & Glowing Effect */}
        <LinearGradient
          colors={['#17202b', '#2d3748']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.cardHeaderTitle}>Overall Business Balance</Text>
          <Text style={[styles.mainBalanceAmount, netBalance >= 0 ? styles.textGreen : styles.textRed]}>
            {formatCurrency(netBalance)}
          </Text>
          <Text style={styles.netLabelText}>Net Business Cash Flow</Text>

          <View style={styles.statsDivider} />

          <View style={styles.statsRow}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.statLabel}>Total Staff</Text>
              <Text style={styles.statValueWhite}>{staffList.length}</Text>
            </View>
            <View style={styles.verticalBorder} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.statLabel}>Total Lena</Text>
              <Text style={[styles.statValue, styles.textGreen]}>{formatCurrency(metrics.totalLena)}</Text>
            </View>
            <View style={styles.verticalBorder} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.statLabel}>Total Dena</Text>
              <Text style={[styles.statValue, styles.textRed]}>{formatCurrency(metrics.totalDena)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Action Cards Grid */}
        <View style={styles.quickGrid}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('ReportsDashboard')}
            style={styles.quickCard}
          >
            <Text style={{ fontSize: 24, marginBottom: 4 }}>📊</Text>
            <Text style={styles.quickCardText}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('ActivityLog')}
            style={styles.quickCard}
          >
            <Text style={{ fontSize: 24, marginBottom: 4 }}>📋</Text>
            <Text style={styles.quickCardText}>Activity Log</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('RemindersCenter')}
            style={styles.quickCard}
          >
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🔔</Text>
            <Text style={styles.quickCardText}>Reminders</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('SyncCenter')}
            style={styles.quickCard}
          >
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🔄</Text>
            <Text style={styles.quickCardText}>Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Staff Members Section */}
        <View style={{ marginBottom: 40 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Staff Members ({staffList.length})</Text>
            <TouchableOpacity onPress={loadStaffData}>
              <Text style={styles.refreshText}>Refresh 🔄</Text>
            </TouchableOpacity>
          </View>
          
          {staffList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No staff members registered</Text>
            </View>
          ) : (
            <FlatList
              data={staffList}
              renderItem={renderStaffItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },
  header: {
    backgroundColor: themeColors.cardBg,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: themeColors.textSecondary, marginTop: 2 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: themeColors.inputBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: themeColors.borderLight,
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#1dd1a1' },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: themeColors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },

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

  balanceCard: {
    borderRadius: 18, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#5f27cd', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  cardHeaderTitle: { color: themeColors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  mainBalanceAmount: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  netLabelText: { color: themeColors.textMuted, fontSize: 12, marginTop: 2 },
  statsDivider: { height: 1, backgroundColor: themeColors.border, marginVertical: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verticalBorder: { width: 1, height: 32, backgroundColor: themeColors.border },
  statLabel: { color: themeColors.textSecondary, fontSize: 11, fontWeight: '500', marginBottom: 2 },
  statValueWhite: { color: '#fff', fontSize: 17, fontWeight: '800' },
  statValue: { fontSize: 16, fontWeight: '800' },

  quickGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickCard: {
    flex: 1, backgroundColor: themeColors.cardBg, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  quickCardText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  refreshText: { color: '#1dd1a1', fontSize: 13, fontWeight: '700' },

  staffCard: {
    backgroundColor: themeColors.cardBg, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  staffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  staffPhone: { color: themeColors.textSecondary, fontSize: 13, marginTop: 2 },
  staffBiz: { color: themeColors.textMuted, fontSize: 11, marginTop: 2 },
  netBalanceText: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  textGreen: { color: themeColors.success, fontWeight: '700' },
  textRed: { color: themeColors.error, fontWeight: '700' },

  emptyCard: { backgroundColor: themeColors.cardBg, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: themeColors.border },
  emptyText: { color: themeColors.textSecondary, fontSize: 14 },

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
