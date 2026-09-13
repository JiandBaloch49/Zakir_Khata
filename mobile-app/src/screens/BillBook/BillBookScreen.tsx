import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  Animated, ActivityIndicator, Dimensions, Alert, Keyboard, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useBillStore } from '../../store/useBillStore';
import { Bill } from '../../types/bill.types';
import { formatCurrency } from '../../utils/calculations';
import { DateRangeFilter, DateRange, describeRange } from '../../components/ui/DateRangeFilter';
import { themeColors } from '../../theme/theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';

const ORANGE = '#FF6B35';
const GREEN = '#4CAF50';
const RED = '#EF4444';
const GRAY = '#9CA3AF';
const BLUE = '#3B82F6';

const getStatusColor = (item: Bill) => {
  if (item.is_draft) return { bg: '#E5E7EB', text: '#4B5563', label: 'DRAFT' };
  if (item.is_hold) return { bg: '#FEF3C7', text: '#D97706', label: 'ON HOLD' };
  if (item.status === 'paid') return { bg: '#DCFCE7', text: '#15803D', label: 'PAID' };
  if (item.status === 'unpaid') return { bg: '#FEE2E2', text: '#DC2626', label: 'UNPAID' };
  return { bg: '#FFEDD5', text: '#C2410C', label: 'PARTIAL' }; // partial
};

const BillItemView = React.memo(({ item, onPress }: { item: Bill, onPress: (item: Bill) => void }) => {
  const statusTheme = getStatusColor(item);
  return (
    <TouchableOpacity 
      style={styles.itemRow}
      onPress={() => onPress(item)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.billNumber}>Bill #{item.bill_no}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg }]}>
          <Text style={[styles.statusText, { color: statusTheme.text }]}>
            {statusTheme.label}
          </Text>
        </View>
      </View>

      <View style={styles.itemFooter}>
        <Text style={styles.partyName}>{item.party_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.billTotal}>{formatCurrency(item.total)}</Text>
          <Text style={{ color: GRAY, fontSize: 16, marginLeft: 8 }}>{'>'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const BillBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { bills, loading, summary, fetchBills, filter, setFilter } = useBillStore();

  const filterTab = filter.status ?? 'posted';
  const range: DateRange = { startDate: filter.startDate, endDate: filter.endDate };
  const apply = (next: Partial<typeof filter>) => { if (user) setFilter(user.id, { ...filter, ...next }); };
  const setRange = (next: DateRange) => apply(next);
  const setFilterTab = (status: 'posted' | 'drafts' | 'holds') => apply({ status });
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  const loadData = () => {
    if (user) fetchBills(user.id);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, user]);

  useEffect(() => {
    loadData();
  }, [user]);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleBillPress = React.useCallback((item: Bill) => {
    if (item.is_draft || item.is_hold) {
      Alert.alert('Resume Bill', 'Do you want to resume this bill?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume POS', onPress: () => navigation.navigate('CreateNewBillModal', { billId: item.id }) }
      ]);
    } else {
      navigation.navigate('BillDetailScreen', { billId: item.id });
    }
  }, [navigation]);

  // Status is part of the SQL predicate now, so the list the user sees and the
  // headline totals below always describe the same set of bills.
  const filteredBills = bills;

  const rangeLabel = describeRange(range);

  const renderItem = React.useCallback(({ item }: { item: Bill }) => {
    return <BillItemView item={item} onPress={handleBillPress} />;
  }, [handleBillPress]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="BillBook" />

      {/* Sub Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Bill Book</Text>
        <TouchableOpacity 
          style={{ padding: 6 }} 
          onPress={() => navigation.navigate('DownloadOptionsModal', { reportType: 'bill' })}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1dd1a1' }}>⬇ PDF Report</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total sale {rangeLabel} · {summary.billCount} bill{summary.billCount === 1 ? '' : 's'}</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(summary.totalBilled)}</Text>
      </View>

      {/* Date Range Filter — real, in the same slot the fake boxes occupied */}
      <View style={styles.dateFilterContainer}>
        <DateRangeFilter value={range} onChange={setRange}
          fieldStyle={styles.dateBox} textStyle={styles.dateLabel} />
      </View>

      {/* Status Filters */}
      <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 12, gap: 8 }}>
        {(['posted', 'drafts', 'holds'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterChip, filterTab === tab && styles.filterChipActive]}
            onPress={() => setFilterTab(tab)}
          >
            <Text style={[styles.filterChipText, filterTab === tab && styles.filterChipTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : filteredBills.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 140, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={styles.emptyState}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.instructionText}>1- Create bills</Text>
              <Text style={styles.instructionText}>2- Share with customers</Text>
              <Text style={styles.instructionText}>3- Get paid 3X faster</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredBills}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 140 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* Add Item Button */}
      {!isKeyboardVisible && (
        <View style={[styles.addBtnContainer, { bottom: 85 + Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateNewBillModal')}>
            <Text style={styles.addBtnText}>+ CREATE NEW BILL</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: themeColors.cardBg, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: themeColors.border,
  },
  backBtn: { width: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  settingsBtn: { padding: 4 },
  settingsIcon: { fontSize: 18, color: themeColors.textSecondary },

  summaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: themeColors.cardBg, marginHorizontal: 12, marginTop: 12,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, elevation: 3
  },
  summaryTitle: { fontSize: 13, color: themeColors.textSecondary, fontWeight: '600' },
  summaryAmount: { fontSize: 17, fontWeight: '800', color: '#fff' },

  dateFilterContainer: {
    flexDirection: 'row', backgroundColor: themeColors.cardBg, marginHorizontal: 12, marginTop: 12,
    borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, elevation: 3
  },
  dateBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dateIcon: { fontSize: 20, color: themeColors.primaryTeal, marginRight: 8 },
  dateLabel: { fontSize: 11, color: themeColors.textSecondary },
  dateValue: { fontSize: 13, color: '#fff', fontWeight: '600' },
  dateDivider: { width: 1, height: 36, backgroundColor: themeColors.border, marginHorizontal: 12 },

  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: themeColors.inputBg, borderWidth: 1, borderColor: themeColors.borderLight },
  filterChipActive: { backgroundColor: themeColors.primary, borderColor: '#1dd1a1' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: themeColors.textSecondary },
  filterChipTextActive: { color: '#fff', fontWeight: '800' },

  itemRow: {
    backgroundColor: themeColors.cardBg, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, elevation: 3
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  billNumber: { fontSize: 15, fontWeight: '700', color: '#fff' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partyName: { fontSize: 13, color: themeColors.textSecondary },
  billTotal: { fontSize: 15, fontWeight: '800', color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcons: { position: 'relative', width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  shieldWrap: { position: 'absolute', top: -10, left: -10, backgroundColor: themeColors.cardBg, borderRadius: 40 },
  instructionText: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 8 },
  arrowWrap: { marginTop: 24 },
  arrowIcon: { fontSize: 36, color: '#1dd1a1', fontWeight: '800' },

  addBtnContainer: {
    position: 'absolute', bottom: 75, left: 0, right: 0, alignItems: 'center'
  },
  addBtn: {
    backgroundColor: themeColors.primary, width: '80%', height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  tabBar: {
    backgroundColor: themeColors.cardBg, borderTopWidth: 1, borderTopColor: themeColors.border, height: 60, flexDirection: 'row'
  },
  tabItem: { width: Dimensions.get('window').width / 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  tabItemActive: {},
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: themeColors.textSecondary },
  tabLabelActive: { color: '#1dd1a1' },
  tabIndicator: { position: 'absolute', bottom: 2, width: 24, height: 3, backgroundColor: '#1dd1a1', borderRadius: 2 },
});
