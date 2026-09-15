import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, Alert, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getFilteredKhata, getKhataDayTotals, KhataDayTotal } from '../../services/database/transactionDb';
import { PAGE_SIZE, PageCursor } from '../../services/database/pagination';
import { DateRangeFilter, DateRange, describeRange } from '../../components/ui/DateRangeFilter';
import { thisMonthRange, toDateValue, formatDisplayDate } from '../../utils/dates';
import { TransactionItem } from '../../components/TransactionItem';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { generateTransactionPDF } from '../../utils/pdfGenerator';
import { themeColors } from '../../theme/theme';

export const KhataScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  // Rows are PAGED (keyset, PAGE_SIZE at a time); Total Lena / Dena / Net and the
  // per-day subtotals are SQL aggregates over the WHOLE filtered set, fetched once
  // per filter change — never from loaded rows.
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{ totalLena: number; totalDena: number; netBalance: number } | null>(null);
  const [dayTotals, setDayTotals] = useState<Map<string, KhataDayTotal>>(new Map());
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Opens on this month (was: all time). All-time balances per customer live in the
  // Customer Ledger, linked directly under the summary bar.
  const [range, setRange] = useState<DateRange>(() => thisMonthRange());
  const request = useRef(0);
  const [filterType, setFilterType] = useState<'all' | 'lena' | 'dena'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeFilter = useMemo(() => ({ ...range, type: filterType, search: searchQuery }), [range, filterType, searchQuery]);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError('');
    setTransactions([]);
    setSummary(null);
    setCursor(null);
    if (!user?.id) { setLoading(false); return; }
    try {
      const [page, days] = await Promise.all([
        getFilteredKhata(user.id, activeFilter, PAGE_SIZE),
        getKhataDayTotals(user.id, activeFilter),
      ]);
      if (current !== request.current) return;
      setTransactions(page.transactions);
      setSummary(page.balanceSummary);
      setCursor(page.nextCursor);
      setDayTotals(new Map(days.map(d => [d.day, d])));
    } catch (e) {
      if (current === request.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [user?.id, activeFilter]);

  // Next page: strictly after the last loaded row. Totals are NOT refetched here.
  const loadMore = useCallback(async () => {
    if (!user?.id || !cursor || loadingMore || loading) return;
    const current = request.current;
    setLoadingMore(true);
    try {
      const page = await getFilteredKhata(user.id, activeFilter, PAGE_SIZE, 0, cursor);
      if (current !== request.current) return;
      setTransactions(prev => [...prev, ...page.transactions]);
      setCursor(page.nextCursor);
    } catch (e) {
      if (__DEV__) console.error('[Khata] load more failed:', e);
    } finally {
      if (current === request.current) setLoadingMore(false);
    }
  }, [user?.id, activeFilter, cursor, loadingMore, loading]);

  // Group loaded rows by calendar day; a day straddling a page boundary keeps ONE
  // section whose header shows the day's whole SQL subtotal.
  const sections = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const day = toDateValue(t.date) || String(t.date);
      const list = byDay.get(day);
      if (list) list.push(t); else byDay.set(day, [t]);
    }
    return [...byDay.entries()].map(([day, data]) => ({ day, data }));
  }, [transactions]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++request.current; };
  }, [load]));

  const result = summary;
  const balanceSummary = summary || { totalLena: 0, totalDena: 0, netBalance: 0 };

  const handleGeneratePDF = async () => {
    if (!user?.id) return;
    try {
      // The export covers the WHOLE filtered range, not just the pages loaded so far.
      const { transactions: all } = await getFilteredKhata(user.id, activeFilter);
      if (all.length === 0) {
        Alert.alert('No Data', 'No transactions to export');
        return;
      }
      await generateTransactionPDF(all, user?.businessName || 'My Business', user?.name || 'Staff');
    } catch {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  // Day header — the day's own Lena (credit given) and Dena (payment received),
  // the ledger's vocabulary, in the summary bar's colours.
  const renderSectionHeader = useCallback(({ section }: { section: { day: string } }) => {
    const t = dayTotals.get(section.day);
    return (
      <View style={styles.dayHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayTitle}>{formatDisplayDate(section.day)}</Text>
          {t && <Text style={styles.dayCount}>{t.entryCount} {t.entryCount === 1 ? 'Entry' : 'Entries'}</Text>}
        </View>
        {t && (
          <View style={styles.dayRight}>
            <View style={styles.dayCols}>
              <Text style={[styles.dayColLabel, styles.textGreen]}>Lena</Text>
              <Text style={[styles.dayColLabel, styles.textRed]}>Dena</Text>
            </View>
            <View style={styles.dayCols}>
              <Text style={[styles.dayColVal, styles.textGreen]}>{formatCurrency(t.lena)}</Text>
              <Text style={[styles.dayColVal, styles.textRed]}>{formatCurrency(t.dena)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }, [dayTotals]);

  const renderTransactionItem = React.useCallback(({ item }: { item: Transaction }) => (
    <TransactionItem
      transaction={item}
      onPress={() => navigation.navigate('EditTransaction', { transactionId: item.id })}
    />
  ), [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Dark Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Khata (Ledger)</Text>
          <TouchableOpacity onPress={handleGeneratePDF} style={styles.pdfBtn}>
            <Text style={styles.pdfBtnText}>📄 Export PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(['all', 'lena', 'dena'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filterType === f && styles.filterBtnActive]}
              onPress={() => setFilterType(f)}
            >
              <Text style={[styles.filterText, filterType === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dark Search Input */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search by party name or notes..."
          placeholderTextColor={themeColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <DateRangeFilter value={range} onChange={setRange}
          fieldStyle={styles.searchInput} textStyle={styles.filterText} />
      </View>

      {/* Summary Bar — for the SELECTED RANGE (this month by default) */}
      <View style={styles.summaryBar}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.summaryLabel}>Total Lena</Text>
          <Text style={[styles.summaryVal, styles.textGreen]}>{result ? formatCurrency(balanceSummary.totalLena) : '—'}</Text>
        </View>
        <View style={styles.vertDivider} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.summaryLabel}>Total Dena</Text>
          <Text style={[styles.summaryVal, styles.textRed]}>{result ? formatCurrency(balanceSummary.totalDena) : '—'}</Text>
        </View>
        <View style={styles.vertDivider} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.summaryLabel}>Net Balance</Text>
          <Text style={[styles.summaryVal, balanceSummary.netBalance >= 0 ? styles.textGreen : styles.textRed]}>
            {result ? formatCurrency(balanceSummary.netBalance) : '—'}
          </Text>
        </View>
      </View>

      {/* What the totals above cover, and the way to ALL-TIME balances per customer */}
      <TouchableOpacity style={styles.ledgerLink} onPress={() => navigation.navigate('CustomerLedger')} activeOpacity={0.7}>
        <Text style={styles.ledgerLinkText} numberOfLines={1}>Totals for {describeRange(range)}</Text>
        <Text style={styles.ledgerLinkAction}>All-time balance per customer ›</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.emptyContainer}><ActivityIndicator color={themeColors.primary} /></View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.filterBtn}><Text style={styles.filterText}>Retry</Text></TouchableOpacity>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transactions found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderTransactionItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 140 }}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshing={loading}
          onRefresh={load}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={themeColors.primary} /> : null}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: themeColors.background },
  header: {
    backgroundColor: themeColors.cardBg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  pdfBtn: { backgroundColor: themeColors.inputBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: themeColors.borderLight },
  pdfBtnText: { color: '#1dd1a1', fontSize: 12, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: themeColors.inputBg, borderWidth: 1, borderColor: themeColors.borderLight,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: themeColors.primary, borderColor: '#1dd1a1' },
  filterText: { fontSize: 13, fontWeight: '600', color: themeColors.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '800' },

  searchInput: {
    backgroundColor: themeColors.inputBg, borderWidth: 1, borderColor: themeColors.borderLight,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#fff', minHeight: 44,
  },

  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: themeColors.cardBg, paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  vertDivider: { width: 1, height: 28, backgroundColor: themeColors.border },
  summaryLabel: { color: themeColors.textSecondary, fontSize: 11, fontWeight: '600' },
  summaryVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  textGreen: { color: themeColors.success },
  textRed: { color: themeColors.error },

  // Range caption + Customer Ledger link: the summary bar's surface, one slim row.
  ledgerLink: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    backgroundColor: themeColors.cardBg, paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: themeColors.border,
  },
  ledgerLinkText: { flex: 1, fontSize: 11, fontWeight: '600', color: themeColors.textSecondary },
  ledgerLinkAction: { fontSize: 12, fontWeight: '800', color: '#1dd1a1', flexShrink: 0 },

  // Day header — the Cash Book day-header banner, with the ledger's Lena/Dena columns.
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: themeColors.cardBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: themeColors.border, marginBottom: 8,
  },
  dayTitle: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  dayCount: { fontSize: 12, color: themeColors.textSecondary, marginTop: 2 },
  dayRight: { alignItems: 'flex-end' },
  dayCols: { flexDirection: 'row', gap: 16 },
  dayColLabel: { fontSize: 12, fontWeight: '700', minWidth: 60, textAlign: 'right', marginBottom: 2 },
  dayColVal: { fontSize: 13, fontWeight: '800', minWidth: 60, textAlign: 'right', flexShrink: 0 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: themeColors.textSecondary, fontSize: 15, fontWeight: '500' },
});
