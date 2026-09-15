import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StockItem, StockMovement } from '../../types/stock.types';
import { getItemMovements, getItemMovementMonths, addStockMovement } from '../../services/database/stockDb';
import { PAGE_SIZE, PageCursor } from '../../services/database/pagination';
import { formatCurrency } from '../../utils/calculations';
import { getDisplayName } from '../../utils/displayName';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

const getCurrentMonthKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

export const StockItemDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params as { item: StockItem };
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const { nameDisplayMode } = useSettingsStore();
  const { user } = useAuthStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'in' | 'out'>('in');
  const [inputQty, setInputQty] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [inputDate, setInputDate] = useState(() => todayDate());
  const [saving, setSaving] = useState(false);

  // Default month filter state to Current Month ('YYYY-MM')
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);
  const monthScrollRef = useRef<ScrollView>(null);

  // The selected month is filtered in SQL and its In/Out totals are a SQL aggregate;
  // only that month's rows are fetched, PAGE_SIZE at a time.
  const [monthsWithMovement, setMonthsWithMovement] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0, count: 0 });
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const [{ rows, summary, nextCursor }, months] = await Promise.all([
        getItemMovements(item.id, selectedMonth, PAGE_SIZE),
        getItemMovementMonths(item.id),
      ]);
      setMovements(rows);
      setStats(summary);
      setCursor(nextCursor);
      setMonthsWithMovement(months);
    } catch (err) {
      if (__DEV__) console.error('Failed to load stock movements:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const { rows, nextCursor } = await getItemMovements(item.id, selectedMonth, PAGE_SIZE, cursor);
      setMovements(prev => [...prev, ...rows]);
      setCursor(nextCursor);
    } catch (err) {
      if (__DEV__) console.error('Failed to load more movements:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadMovements(); }, [item.id, selectedMonth]);

  // Generate available month options in chronological sequential order (Jan to Dec)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const currentYear = new Date().getFullYear();
    
    // Add all 12 months of the current year in sequence (Jan to Dec)
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      monthSet.add(`${currentYear}-${mm}`);
    }

    // Months in which this item actually moved — from SQL, not from loaded rows.
    monthsWithMovement.forEach(key => monthSet.add(key));

    const sorted = Array.from(monthSet).sort(); // Ascending chronological order: Jan -> Dec
    return ['ALL', ...sorted];
  }, [monthsWithMovement]);

  // Auto scroll to active month pill
  useEffect(() => {
    const index = availableMonths.indexOf(selectedMonth);
    if (index >= 0 && monthScrollRef.current) {
      setTimeout(() => {
        monthScrollRef.current?.scrollTo({ x: Math.max(0, index * 60 - 40), animated: true });
      }, 100);
    }
  }, [selectedMonth, availableMonths]);

  // Rows are already the selected month (SQL); stats are the month's SQL aggregate.
  const filteredMovements = movements;
  const monthlyStats = { totalIn: stats.totalIn, totalOut: stats.totalOut, netChange: stats.totalIn - stats.totalOut };

  const openModal = (mode: 'in' | 'out') => {
    setModalMode(mode);
    setInputQty('');
    setInputNote('');
    // Default entry date to current selected month date or today
    const todayStr = todayDate();
    if (selectedMonth !== 'ALL' && !todayStr.startsWith(selectedMonth)) {
      setInputDate(`${selectedMonth}-01`);
    } else {
      setInputDate(todayStr);
    }
    setModalVisible(true);
  };

  const handleSaveMovement = async () => {
    const qty = parseFloat(inputQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive quantity.');
      return;
    }
    if (!user?.id) return;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!inputDate || !dateRegex.test(inputDate)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      const isOut = modalMode === 'out';

      const movement: Omit<StockMovement, 'id' | 'synced' | 'is_deleted'> = {
        item_id: item.id,
        change: isOut ? -qty : qty,
        reason: isOut ? 'sale' : 'purchase',
        // stock_movements.date is a plain YYYY-MM-DD calendar day, like every other
        // book. It previously stored a UTC timestamp anchored at local noon.
        date: inputDate,
        cost_per_unit: !isOut ? item.purchase_price : undefined,
        sale_price_unit: isOut ? item.sale_price : undefined,
        user_id: user.id,
        note: inputNote.trim() || undefined,
      };

      await addStockMovement(movement);
      await loadMovements();
      item.quantity += movement.change;
      setModalVisible(false);
    } catch (error) {
      if (__DEV__) console.error(error);
      Alert.alert('Error', 'Failed to save stock movement.');
    } finally {
      setSaving(false);
    }
  };

  const formatMonthLabel = (monthKey: string) => {
    if (monthKey === 'ALL') return 'All';
    const [yyyy, mm] = monthKey.split('-');
    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
    return date.toLocaleString('default', { month: 'short', year: '2-digit' });
  };

  const renderMovement = ({ item: mov }: { item: StockMovement }) => {
    const isOut = mov.change < 0;
    const date = new Date(mov.date).toLocaleDateString();
    return (
      <View style={styles.movRow}>
        <View style={styles.movLeft}>
          <Text style={styles.movReason}>{mov.reason.toUpperCase()}</Text>
          <Text style={styles.movDate}>{date}{mov.note ? ` • ${mov.note}` : ''}</Text>
        </View>
        <View style={styles.movRight}>
          <Text style={[styles.movChange, isOut ? { color: Colors.error } : { color: Colors.success }]}>
            {isOut ? '' : '+'}{mov.change} {item.unit}
          </Text>
          {(mov.cost_per_unit || mov.sale_price_unit) ? (
            <Text style={styles.movPrice}>
              @{formatCurrency((mov.cost_per_unit || mov.sale_price_unit || 0))}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Compact Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {getDisplayName(item, nameDisplayMode)}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={false} hasTabBar={true} style={styles.container}>
        {/* Compact Item Summary Bar */}
        <View style={styles.compactInfoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.compactCategory}>{item.category} • {item.location || 'No Loc'}</Text>
            <Text style={styles.compactStock}>Stock: <Text style={styles.stockBold}>{item.quantity} {item.unit}</Text></Text>
          </View>
          <View style={styles.pricesRow}>
            <Text style={styles.priceLabel}>Buy: {formatCurrency(item.purchase_price)}</Text>
            <Text style={styles.priceLabel}>Sell: {formatCurrency(item.sale_price)}</Text>
            {item.barcode ? <Text style={styles.priceLabel}>BC: {item.barcode}</Text> : null}
          </View>
        </View>

        {/* Compact Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => openModal('in')}>
            <Text style={styles.actionBtnText}>+ IN / BUY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.error }]} onPress={() => openModal('out')}>
            <Text style={styles.actionBtnText}>- OUT / SELL</Text>
          </TouchableOpacity>
        </View>

        {/* Month Filter & Inline Stats Bar */}
        <View style={styles.monthSection}>
          <ScrollView 
            ref={monthScrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.monthScroll}
          >
            {availableMonths.map(mKey => {
              const active = selectedMonth === mKey;
              return (
                <TouchableOpacity
                  key={mKey}
                  style={[styles.monthPill, active && styles.monthPillActive]}
                  onPress={() => setSelectedMonth(mKey)}
                >
                  <Text style={[styles.monthPillText, active && styles.monthPillTextActive]}>
                    {formatMonthLabel(mKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.inlineSummary}>
            <Text style={styles.summaryText}>
              In: <Text style={{ color: Colors.success, fontWeight: '700' }}>+{monthlyStats.totalIn}</Text> | Out: <Text style={{ color: Colors.error, fontWeight: '700' }}>-{monthlyStats.totalOut}</Text> | Net: <Text style={{ color: monthlyStats.netChange >= 0 ? Colors.success : Colors.error, fontWeight: '700' }}>{monthlyStats.netChange >= 0 ? '+' : ''}{monthlyStats.netChange}</Text>
            </Text>
          </View>
        </View>

        {/* Stock Entries List (Takes Max Height) */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Stock Entries ({stats.count})</Text>
          </View>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : filteredMovements.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No stock entries for {formatMonthLabel(selectedMonth)}.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMovements}
              keyExtractor={(mov) => mov.id}
              renderItem={renderMovement}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={Colors.primary} /> : null}
            />
          )}
        </View>
      </ScreenContainer>

      {/* Movement Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'in' ? 'Stock In (Buy)' : 'Stock Out (Sell)'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Quantity ({item.unit}) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={Colors.textGray}
                keyboardType="numeric"
                value={inputQty}
                onChangeText={setInputQty}
                autoFocus
              />

              <Text style={styles.modalLabel}>Entry Date *</Text>
              <DateField
                style={styles.modalInput}
                value={inputDate}
                onChange={setInputDate}
              />

              <View style={styles.calcRow}>
                <Text style={styles.calcText}>
                  Price: {formatCurrency((modalMode === 'in' ? item.purchase_price : item.sale_price))} / unit
                </Text>
                <Text style={styles.calcTotalText}>
                  Total: {formatCurrency(((modalMode === 'in' ? item.purchase_price : item.sale_price) * (parseFloat(inputQty) || 0)))}
                </Text>
              </View>

              <Text style={styles.modalLabel}>Note (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 48, textAlignVertical: 'top' }]}
                placeholder="Reason or reference..."
                placeholderTextColor={Colors.textGray}
                value={inputNote}
                onChangeText={setInputNote}
                multiline
              />

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: modalMode === 'in' ? Colors.success : Colors.error }]}
                onPress={handleSaveMovement}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE ENTRY</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 12, height: 48,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: Colors.textWhite },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textWhite, flex: 1, textAlign: 'center' },

  compactInfoCard: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactCategory: { fontSize: 12, color: Colors.textGray },
  compactStock: { fontSize: 12, color: Colors.textGray },
  stockBold: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  pricesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  priceLabel: { fontSize: 11, color: Colors.textMuted },

  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  monthSection: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  monthScroll: {
    gap: 6,
    paddingRight: 12,
    paddingVertical: 2,
  },
  monthPill: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  monthPillText: {
    color: Colors.textGray,
    fontSize: 11,
    fontWeight: '600',
  },
  monthPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  inlineSummary: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 11,
    color: Colors.textGray,
  },

  listContainer: { flex: 1 },
  listHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listTitle: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  
  movRow: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  movLeft: { flex: 1 },
  movReason: { fontSize: 12, fontWeight: '700', color: Colors.textWhite },
  movDate: { fontSize: 11, color: Colors.textGray, marginTop: 1 },
  movRight: { alignItems: 'flex-end' },
  movChange: { fontSize: 14, fontWeight: '800' },
  movPrice: { fontSize: 10, color: Colors.textGray },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 100 },
  emptyState: { padding: 20, alignItems: 'center' },
  emptyText: { color: Colors.textGray, fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textGray,
    padding: 4,
  },
  modalBody: {},
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.textWhite,
    marginBottom: 12,
  },
  calcRow: {
    backgroundColor: Colors.bgSecondary,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calcText: {
    fontSize: 12,
    color: Colors.textGray,
  },
  calcTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: 2,
  },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
