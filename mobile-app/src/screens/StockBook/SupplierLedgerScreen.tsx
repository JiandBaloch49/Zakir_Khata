import React, { useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupplierStore } from '../../store/useSupplierStore';
import { SupplierLedgerEntry } from '../../types/supplier.types';
import { formatCurrency } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';

const LedgerRow = React.memo(({ item, index }: { item: SupplierLedgerEntry; index: number }) => {
  const icon = item.type === 'invoice' ? '🧾' : item.type === 'return' ? '↩️' : '💳';
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowIcon}>{icon}</Text>
        <View>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.rowDate}>{item.date}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        {item.amount > 0 && (
          <Text style={styles.debitAmt}>+{formatCurrency(item.amount)}</Text>
        )}
        {item.credit > 0 && (
          <Text style={styles.creditAmt}>-{formatCurrency(item.credit)}</Text>
        )}
        <Text style={[styles.balance, item.balance >= 0 ? styles.balRed : styles.balGreen]}>
          {formatCurrency(Math.abs(item.balance))}
        </Text>
      </View>
    </View>
  );
});

export const SupplierLedgerScreen = ({ navigation, route }: any) => {
  const { supplierId, supplierName } = route.params;
  const { ledger, loading, loadSupplierLedger } = useSupplierStore();

  const load = useCallback(() => loadSupplierLedger(supplierId), [supplierId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const totalDebit = ledger.reduce((s, e) => s + e.amount, 0);
  const totalCredit = ledger.reduce((s, e) => s + e.credit, 0);
  const netBalance = totalDebit - totalCredit;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Ledger</Text>
          <Text style={styles.headerSub}>{supplierName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={false} hasTabBar={false} style={styles.container}>
        {/* Summary Totals */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: Colors.bgCard }]}>
            <Text style={styles.summaryLabel}>Total Payable</Text>
            <Text style={[styles.summaryAmt, { color: Colors.error }]}>{formatCurrency(totalDebit)}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: Colors.bgCard }]}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={[styles.summaryAmt, { color: Colors.success }]}>{formatCurrency(totalCredit)}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: Colors.bgCard, flex: 1.2 }]}>
            <Text style={styles.summaryLabel}>Net Balance</Text>
            <Text style={[styles.summaryAmt, { color: netBalance > 0 ? Colors.warning : Colors.success, fontSize: 15 }]}>
              {netBalance > 0 ? 'Payable' : 'Credit'}: {formatCurrency(Math.abs(netBalance))}
            </Text>
          </View>
        </View>

        {/* Column Headers */}
        <View style={styles.colHeader}>
          <Text style={[styles.colText, { flex: 2 }]}>Description</Text>
          <Text style={[styles.colText, { textAlign: 'right' }]}>Debit</Text>
          <Text style={[styles.colText, { textAlign: 'right' }]}>Credit</Text>
          <Text style={[styles.colText, { textAlign: 'right' }]}>Balance</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
        ) : ledger.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📒</Text>
            <Text style={styles.emptyText}>No ledger entries yet</Text>
            <Text style={styles.emptySub}>Invoices and payments will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={ledger}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => <LedgerRow item={item} index={index} />}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
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
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  headerSub: { fontSize: 12, color: Colors.primaryLight },
  summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
  summaryBox: {
    flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  summaryLabel: { fontSize: 11, color: Colors.textGray, fontWeight: '600' },
  summaryAmt: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  colHeader: {
    flexDirection: 'row', backgroundColor: Colors.bgSecondary, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  colText: { flex: 1, fontSize: 12, color: Colors.textGray, fontWeight: '700' },
  row: {
    flexDirection: 'row', backgroundColor: Colors.bgCard, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center',
  },
  rowLeft: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 18 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  rowDate: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  rowRight: { flex: 2, alignItems: 'flex-end' },
  debitAmt: { fontSize: 13, fontWeight: '700', color: Colors.error },
  creditAmt: { fontSize: 13, fontWeight: '700', color: Colors.success },
  balance: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  balRed: { color: Colors.warning },
  balGreen: { color: Colors.success },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textWhite, marginTop: 12 },
  emptySub: { fontSize: 13, color: Colors.textGray, marginTop: 4 },
});
