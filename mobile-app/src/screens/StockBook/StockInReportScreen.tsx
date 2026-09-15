import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, SectionList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useStockStore } from '../../store/useStockStore';
import { StockReportEntry } from '../../services/database/stockDb';
import { formatCurrency } from '../../utils/calculations';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { DateRangeFilter } from '../../services/database/reports/types';
import { getDisplayName } from '../../utils/displayName';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Colors } from '../../theme';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { localDate, toDateValue, formatDisplayDate } from '../../utils/dates';
import * as Print from 'expo-print';
import { useDownloadStore } from '../../store/useDownloadStore';

export const StockInReportScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const report = useStockStore(s => s.movementReport.in);
  const fetchMovementReport = useStockStore(s => s.fetchMovementReport);
  const loadMoreMovementReport = useStockStore(s => s.loadMoreMovementReport);
  const { rows, summary, dayTotals, loading, loadingMore } = report;
  const { nameDisplayMode } = useSettingsStore();

  const { isGenerating, generateFile } = useDownloadStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Range AND search are part of the SQL predicate, so the paged rows, the header
  // totals and the day subtotals always describe the same set.
  useEffect(() => {
    if (user) {
      const startStr = startDate ? localDate(startDate) : undefined;
      const endStr = endDate ? localDate(endDate) : undefined;
      fetchMovementReport(user.id, 'in', { startDate: startStr, endDate: endStr, search: searchQuery });
    }
  }, [user, startDate, endDate, searchQuery]);

  // The range this screen is showing, as the export and print must cover it.
  const shownPeriod = () => ({
    startDate: startDate ? localDate(startDate) : undefined,
    endDate: endDate ? localDate(endDate) : undefined,
  });

  const handleExport = () => navigation.navigate('DownloadOptionsModal', { reportType: 'stockIn', period: shownPeriod() });

  // Real printing: the same generator builds the PDF, then the OS print dialog opens it.
  const handlePrint = async () => {
    if (!user) return;
    try {
      const uri = await generateFile({ reportType: 'stockIn', userId: user.id, ...shownPeriod(), format: 'pdf' });
      await Print.printAsync({ uri });
    } catch (err: any) {
      if (__DEV__) console.error('[StockReport] print failed:', err);
      Alert.alert('Print Failed', err?.message || 'Could not print the report. Please try again.');
    }
  };

  const handleFilterChange = (filter: DateRangeFilter) => {
    setStartDate(filter.startDate ? new Date(filter.startDate) : null);
    setEndDate(filter.endDate ? new Date(filter.endDate) : null);
  };

  // Header totals are the whole-set SQL summary, never a sum of the loaded page.
  const totalQty = summary.qty;
  const totalAmount = summary.amount;

  // Loaded movements grouped by day; a day straddling a page boundary keeps ONE
  // section whose header shows the day's whole SQL subtotal.
  const sections = useMemo(() => {
    const byDay = new Map<string, StockReportEntry[]>();
    for (const m of rows) {
      const day = toDateValue(m.date) || String(m.date);
      const list = byDay.get(day);
      if (list) list.push(m); else byDay.set(day, [m]);
    }
    return [...byDay.entries()].map(([day, data]) => ({ day, data }));
  }, [rows]);

  const renderSectionHeader = ({ section }: { section: { day: string } }) => {
    const t = dayTotals[section.day];
    return (
      <View style={styles.dayHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayTitle}>{formatDisplayDate(section.day)}</Text>
          {t && <Text style={styles.dayCount}>{t.entries} {t.entries === 1 ? 'Entry' : 'Entries'}</Text>}
        </View>
        {t && (
          <View style={styles.dayRight}>
            <View style={styles.dayCols}>
              <Text style={[styles.dayColLabel, { color: Colors.success }]}>Qty IN</Text>
              <Text style={[styles.dayColLabel, { color: Colors.textGray }]}>Amount</Text>
            </View>
            <View style={styles.dayCols}>
              <Text style={[styles.dayColVal, { color: Colors.success }]}>{t.qty}</Text>
              <Text style={[styles.dayColVal, { color: Colors.success }]}>{formatCurrency(t.amount)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const loadMore = () => { if (user) loadMoreMovementReport(user.id, 'in'); };

  const renderItem = ({ item }: { item: StockReportEntry }) => {
    const amount = item.change * (item.cost_per_unit || 0);
    return (
      <View style={styles.row}>
        <View style={styles.cellName}>
          <Text style={styles.itemName}>{getDisplayName(item as any, nameDisplayMode)}</Text>
          <Text style={styles.itemDate}>{new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
        </View>
        <View style={styles.cellQty}>
          <Text style={[styles.valText, { color: Colors.success }]}>{item.change}</Text>
        </View>
        <View style={styles.cellRate}>
          <Text style={styles.valText}>{item.cost_per_unit ? formatCurrency(item.cost_per_unit) : '-'}</Text>
        </View>
        <View style={styles.cellAmount}>
          <Text style={[styles.valText, { color: Colors.success }]}>{formatCurrency(amount)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock IN Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={false} hasTabBar={true} style={styles.container}>
        {/* Filters */}
        <View style={styles.filtersContainer}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor={Colors.textGray}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
          <DateFilterPicker onFilterChange={handleFilterChange} />
        </View>

        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <View style={styles.cellNameHeader}>
            <Text style={{ color: Colors.success, fontSize: 16, fontWeight: 'bold' }}>↓</Text>
            <View style={{ marginLeft: 4 }}>
              <Text style={styles.thText}>Entries</Text>
              <Text style={[styles.thSubText, { color: Colors.textWhite }]}>{summary.entries}</Text>
            </View>
          </View>
          <View style={styles.cellQty}>
            <Text style={styles.thText}>Qty</Text>
            <Text style={[styles.thSubText, { color: Colors.success }]}>{totalQty}</Text>
          </View>
          <View style={styles.cellRate}>
            <Text style={styles.thText}>Rate</Text>
          </View>
          <View style={styles.cellAmount}>
            <Text style={styles.thText}>Amount</Text>
            <Text style={[styles.thSubText, { color: Colors.success }]}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={Colors.primary} /> : null}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: Colors.textGray, marginTop: 40 }}>No stock in entries found.</Text>
              </View>
            }
          />
        )}

        {/* Footer Export Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.pdfBtn} onPress={handleExport} disabled={isGenerating}>
            <Text style={styles.pdfBtnText}>📄 PDF Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.printBtn} onPress={handlePrint} disabled={isGenerating}>
            <Text style={styles.printBtnText}>🖨️</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textWhite, fontWeight: '400' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  filtersContainer: { backgroundColor: Colors.bgCard, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchBox: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, height: 42 
  },
  searchIcon: { fontSize: 16, color: Colors.textGray, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textWhite },

  tableHeaderRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSecondary, 
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  thText: { fontSize: 12, color: Colors.textGray, fontWeight: '600' },
  thSubText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  
  cellNameHeader: { flex: 2, flexDirection: 'row', alignItems: 'center' },
  cellName: { flex: 2, justifyContent: 'center' },
  cellQty: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  cellRate: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  cellAmount: { flex: 1.5, alignItems: 'flex-end', justifyContent: 'center' },

  row: {
    flexDirection: 'row', backgroundColor: Colors.bgCard, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  itemName: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  itemDate: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  valText: { fontSize: 13, fontWeight: '600', color: Colors.textWhite },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.bgCard,
    borderTopWidth: 1, borderTopColor: Colors.border
  },
  pdfBtn: {
    flex: 1, backgroundColor: Colors.bgInput, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  pdfBtnText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '700' },
  printBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.warning,
    justifyContent: 'center', alignItems: 'center',
  },
  printBtnText: { fontSize: 22 },

  // Day header — the Cash Book day-header banner with Qty / Amount for the day.
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  dayTitle: { fontSize: 13, fontWeight: '800', color: Colors.textWhite, letterSpacing: 0.5 },
  dayCount: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  dayRight: { alignItems: 'flex-end' },
  dayCols: { flexDirection: 'row', gap: 16 },
  dayColLabel: { fontSize: 12, fontWeight: '700', minWidth: 60, textAlign: 'right', marginBottom: 2 },
  dayColVal: { fontSize: 13, fontWeight: '800', minWidth: 60, textAlign: 'right', flexShrink: 0 },
});
