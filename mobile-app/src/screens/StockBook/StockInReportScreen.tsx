import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ActivityIndicator, Alert } from 'react-native';
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
import { localDate } from '../../utils/dates';

export const StockInReportScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { inReports, loading, fetchInReports } = useStockStore();
  const { nameDisplayMode } = useSettingsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  useEffect(() => {
    if (user) {
      const startStr = startDate ? localDate(startDate) : undefined;
      const endStr = endDate ? localDate(endDate) : undefined;
      fetchInReports(user.id, startStr, endStr);
    }
  }, [user, startDate, endDate]);

  const handleFilterChange = (filter: DateRangeFilter) => {
    setStartDate(filter.startDate ? new Date(filter.startDate) : null);
    setEndDate(filter.endDate ? new Date(filter.endDate) : null);
  };

  const filteredData = inReports.filter(item => {
    const nameEn = (item.item_name_en || (item as any).name || (item as any).description || 'Stock Item').toLowerCase();
    const nameUr = item.item_name_ur?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return nameEn.includes(q) || nameUr.includes(q);
  });

  const totalQty = filteredData.reduce((sum, item) => sum + item.change, 0);
  const totalAmount = filteredData.reduce((sum, item) => sum + (item.change * (item.cost_per_unit || 0)), 0);

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
              <Text style={[styles.thSubText, { color: Colors.textWhite }]}>{filteredData.length}</Text>
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
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: Colors.textGray, marginTop: 40 }}>No stock in entries found.</Text>
              </View>
            }
          />
        )}

        {/* Footer Export Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => Alert.alert('Export PDF', 'This feature is coming soon.')}>
            <Text style={styles.pdfBtnText}>📄 PDF Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.printBtn} onPress={() => Alert.alert('Print', 'This feature is coming soon.')}>
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
  printBtnText: { fontSize: 22 }
});
