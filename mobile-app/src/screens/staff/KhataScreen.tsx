import React, { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getFilteredKhata } from '../../services/database/transactionDb';
import { DateRangeFilter, DateRange } from '../../components/ui/DateRangeFilter';
import { TransactionItem } from '../../components/TransactionItem';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { generateTransactionPDF } from '../../utils/pdfGenerator';
import { themeColors } from '../../theme/theme';

export const KhataScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [result, setResult] = useState<Awaited<ReturnType<typeof getFilteredKhata>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<DateRange>({});
  const request = useRef(0);
  const [filterType, setFilterType] = useState<'all' | 'lena' | 'dena'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError('');
    setResult(null);
    if (!user?.id) { setLoading(false); return; }
    try {
      const next = await getFilteredKhata(user.id, { ...range, type: filterType, search: searchQuery });
      if (current === request.current) setResult(next);
    } catch (e) {
      if (current === request.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [user?.id, range, filterType, searchQuery]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++request.current; };
  }, [load]));

  const filteredTransactions = result?.transactions || [];
  const balanceSummary = result?.balanceSummary || { totalLena: 0, totalDena: 0, netBalance: 0 };

  const handleGeneratePDF = async () => {
    if (filteredTransactions.length === 0) {
      Alert.alert('No Data', 'No transactions to export');
      return;
    }
    try {
      await generateTransactionPDF(filteredTransactions, user?.businessName || 'My Business', user?.name || 'Staff');
    } catch {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

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

      {/* Summary Bar */}
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

      {loading ? (
        <View style={styles.emptyContainer}><ActivityIndicator color={themeColors.primary} /></View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.filterBtn}><Text style={styles.filterText}>Retry</Text></TouchableOpacity>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transactions found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransactionItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 140 }}
          refreshing={loading}
          onRefresh={load}
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

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: themeColors.textSecondary, fontSize: 15, fontWeight: '500' },
});
