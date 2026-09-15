import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getFilteredCashHistory, getCashHistoryDayTotals, deleteCashEntry, CashDayTotal } from '../../services/database/cashbookDb';
import { PAGE_SIZE, PageCursor } from '../../services/database/pagination';
import { thisMonthRange, toDateValue, formatDisplayDate } from '../../utils/dates';
import { DateRangeFilter, DateRange } from '../../components/ui/DateRangeFilter';
import { useTransactionStore } from '../../store/transactionStore';
import { formatCurrency, formatDate } from '../../utils/calculations';
import { CashEntry } from '../../types';
import { Colors } from '../../theme';

type FilterType = 'all' | 'in' | 'out';

const CashEntryRow = React.memo(({ item, onPress, handleDelete }: { item: CashEntry; onPress: () => void; handleDelete: (id: string) => void }) => {
  const isIn = item.direction === 'in';
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.directionDot, { backgroundColor: isIn ? '#22C55E' : '#EF4444' }]} />
      <View style={styles.rowInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.rowDesc, { flexShrink: 1 }]} numberOfLines={1}>{item.description}</Text>
          {!!item.attachment_url && <Text style={{ fontSize: 14 }}>📎</Text>}
        </View>
        <Text style={styles.rowDate}>{formatDate(item.date)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: isIn ? '#22C55E' : '#EF4444' }]}>
          {isIn ? '+' : '-'}{formatCurrency(item.amount_paisa)}
        </Text>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export const CashHistory = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { loadCashBook } = useTransactionStore();

  // Rows are PAGED (keyset, PAGE_SIZE at a time); the summary and the per-day subtotals
  // are SQL aggregates over the WHOLE filtered set, fetched once per filter change.
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [summary, setSummary] = useState<{ cashIn: number; cashOut: number; cashBalance: number } | null>(null);
  const [dayTotals, setDayTotals] = useState<Map<string, CashDayTotal>>(new Map());
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Opens on this month, like the Bill Book; the range control below widens it.
  const [range, setRange] = useState<DateRange>(() => thisMonthRange());
  const [error, setError] = useState('');
  const request = useRef(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const activeFilter = useMemo(() => ({ ...range, direction: filter, search }), [range, filter, search]);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setEntries([]);
    setSummary(null);
    setCursor(null);
    setError('');
    if (!user?.id) { setLoading(false); return; }
    try {
      const [page, days] = await Promise.all([
        getFilteredCashHistory(user.id, activeFilter, PAGE_SIZE),
        getCashHistoryDayTotals(user.id, activeFilter),
      ]);
      if (current !== request.current) return;
      setEntries(page.entries);
      setSummary(page.cashSummary);
      setCursor(page.nextCursor);
      setDayTotals(new Map(days.map(d => [d.day, d])));
    } catch (err) {
      if (current === request.current) setError(err instanceof Error ? err.message : String(err));
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
      const page = await getFilteredCashHistory(user.id, activeFilter, PAGE_SIZE, 0, cursor);
      if (current !== request.current) return;
      setEntries(prev => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
    } catch (err) {
      if (__DEV__) console.error('[CashHistory] load more failed:', err);
    } finally {
      if (current === request.current) setLoadingMore(false);
    }
  }, [user?.id, activeFilter, cursor, loadingMore, loading]);

  // Group the loaded rows by calendar day. A day that straddles a page boundary keeps
  // ONE section: the next page's rows append to it, and its header always shows the
  // day's whole SQL subtotal, not a count of what happens to be loaded.
  const sections = useMemo(() => {
    const byDay = new Map<string, CashEntry[]>();
    for (const e of entries) {
      const day = toDateValue(e.date) || String(e.date);
      const list = byDay.get(day);
      if (list) list.push(e); else byDay.set(day, [e]);
    }
    return [...byDay.entries()].map(([day, data]) => ({ day, data }));
  }, [entries]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++request.current; };
  }, [load]));

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteCashEntry(id, user!.id);
            if (user) await loadCashBook(user.id);
            await load();
          } catch {
            Alert.alert('Error', 'Failed to delete entry.');
          }
        },
      },
    ]);
  }, [user, loadCashBook, load]);

  const result = summary;
  const { cashIn: totalIn, cashOut: totalOut, cashBalance: net } = summary || { cashIn: 0, cashOut: 0, cashBalance: 0 };

  const renderItem = useCallback(({ item }: { item: CashEntry }) => {
    return <CashEntryRow item={item} onPress={() => navigation.navigate('CashEntryDetail', { entry: item })} handleDelete={handleDelete} />;
  }, [handleDelete, navigation]);

  // Day header — the Cash Book's day-header banner, with that day's SQL subtotal.
  const renderSectionHeader = useCallback(({ section }: { section: { day: string } }) => {
    const t = dayTotals.get(section.day);
    return (
      <View style={styles.dateHeaderBanner}>
        <View style={styles.dateHeaderLeft}>
          <Text style={styles.dateTitle}>{formatDisplayDate(section.day)}</Text>
          {t && <Text style={styles.entriesCountText}>{t.entryCount} {t.entryCount === 1 ? 'Entry' : 'Entries'}</Text>}
        </View>
        {t && (
          <View style={styles.dateHeaderRight}>
            <View style={styles.totalsHeaderRow}>
              <Text style={[styles.columnLabel, { color: Colors.error }]}>Out</Text>
              <Text style={[styles.columnLabel, { color: Colors.success }]}>In</Text>
            </View>
            <View style={styles.totalsValueRow}>
              <Text style={[styles.columnVal, { color: Colors.error }]}>{formatCurrency(t.cashOut)}</Text>
              <Text style={[styles.columnVal, { color: Colors.success }]}>{formatCurrency(t.cashIn)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }, [dayTotals]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total In</Text>
          <Text style={[styles.summaryValue, { color: '#22C55E' }]}>{result ? `+${formatCurrency(totalIn)}` : '—'}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Out</Text>
          <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{result ? `-${formatCurrency(totalOut)}` : '—'}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[styles.summaryValue, { color: net >= 0 ? '#22C55E' : '#EF4444' }]}>
            {result ? formatCurrency(net) : '—'}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor={Colors.textGray}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ fontSize: 18, color: Colors.textGray }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'in', 'out'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'in' ? '↑ Cash In' : '↓ Cash Out'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ paddingHorizontal: 12 }}>
        <DateRangeFilter value={range} onChange={setRange}
          fieldStyle={[styles.searchWrap, { margin: 0 }]} textStyle={styles.filterTabText} />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.filterTabText}>Retry</Text></TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No transactions found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={{ padding: 16, paddingBottom: 135 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
          onRefresh={load}
          refreshing={loading}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={Colors.primary} /> : null}
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
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  summaryStrip: {
    flexDirection: 'row', backgroundColor: Colors.bgCard,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: Colors.textGray, marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '800' },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, margin: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textWhite },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 4,
  },
  filterTab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.bgInput, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: 12, fontWeight: '600', color: Colors.textGray },
  filterTabTextActive: { color: Colors.textWhite, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 12,
    padding: 14, gap: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  directionDot: { width: 10, height: 10, borderRadius: 5 },
  rowInfo: { flex: 1 },
  rowDesc: { fontSize: 14, fontWeight: '600', color: Colors.textWhite },
  rowDate: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { fontSize: 15, fontWeight: '800' },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 16 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.textGray },

  // Day header — the same values as CashBookScreen's dateHeaderBanner block.
  dateHeaderBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateHeaderLeft: { flex: 1 },
  dateTitle: { fontSize: 13, fontWeight: '800', color: Colors.textWhite, letterSpacing: 0.5 },
  entriesCountText: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  dateHeaderRight: { alignItems: 'flex-end' },
  totalsHeaderRow: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  totalsValueRow: { flexDirection: 'row', gap: 16 },
  columnLabel: { fontSize: 12, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  columnVal: { fontSize: 13, fontWeight: '800', minWidth: 60, textAlign: 'right', flexShrink: 0 },
});
