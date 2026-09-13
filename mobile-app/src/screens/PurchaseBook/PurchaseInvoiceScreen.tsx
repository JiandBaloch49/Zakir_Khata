import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { formatCurrency } from '../../utils/calculations';
import { PurchaseInvoiceItem } from '../../types/purchase.types';
import { Colors } from '../../theme';

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  unpaid:  { bg: '#7F1D1D', fg: '#FCA5A5', label: 'UNPAID' },
  partial: { bg: '#7C2D12', fg: '#FDBA74', label: 'PARTIAL' },
  paid:    { bg: '#064E3B', fg: '#6EE7B7', label: 'PAID' },
};

export const PurchaseInvoiceScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const { invoiceId } = route.params;
  const { user } = useAuthStore();
  const { selectedInvoice: invoice, loading, loadInvoiceById } = usePurchaseStore();

  const load = useCallback(() => loadInvoiceById(invoiceId), [invoiceId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  if (loading || !invoice) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const ss = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.unpaid;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>#{invoice.invoice_number}</Text>
          <Text style={styles.headerSub}>{invoice.supplier_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
          <Text style={[styles.statusText, { color: ss.fg }]}>{ss.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Invoice Date</Text>
              <Text style={styles.summaryVal}>{invoice.invoice_date}</Text>
            </View>
            {invoice.due_date && (
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Due Date</Text>
                <Text style={[styles.summaryVal, { color: Colors.error }]}>{invoice.due_date}</Text>
              </View>
            )}
            {invoice.po_id && (
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Linked PO</Text>
                <TouchableOpacity onPress={() => navigation.navigate('PurchaseOrderDetail', { orderId: invoice.po_id })}>
                  <Text style={[styles.summaryVal, { color: Colors.primaryLight }]}>View PO →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {invoice.notes && <Text style={styles.notes}>📝 {invoice.notes}</Text>}
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items</Text>
          {(invoice.items ?? []).map((item: PurchaseInvoiceItem) => (
            <View key={item.id} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{item.item_name}</Text>
                <Text style={styles.lineDetail}>{item.quantity} × {formatCurrency(item.unit_cost)}</Text>
              </View>
              <Text style={styles.lineTotal}>{formatCurrency(item.line_total)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>{formatCurrency(invoice.subtotal)}</Text></View>
          {invoice.discount_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: Colors.success }]}>Discount</Text><Text style={[styles.totalVal, { color: Colors.success }]}>-{formatCurrency(invoice.discount_amount)}</Text></View>}
          {invoice.tax_amount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Tax</Text><Text style={styles.totalVal}>{formatCurrency(invoice.tax_amount)}</Text></View>}
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandVal}>{formatCurrency(invoice.total)}</Text>
          </View>
          <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: Colors.success }]}>Amount Paid</Text><Text style={[styles.totalVal, { color: Colors.success }]}>{formatCurrency(invoice.amount_paid)}</Text></View>
          {invoice.balance_due > 0 && (
            <View style={[styles.totalRow, { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: 8, marginTop: 4 }]}>
              <Text style={[styles.grandLabel, { color: Colors.error }]}>Balance Due</Text>
              <Text style={[styles.grandVal, { color: Colors.error }]}>{formatCurrency(invoice.balance_due)}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          {invoice.status !== 'paid' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.bgInput, borderColor: Colors.success }]}
              onPress={() => navigation.navigate('AddSupplierPayment', {
                supplierId: invoice.supplier_id,
                supplierName: invoice.supplier_name,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoice_number,
                maxAmount: invoice.balance_due,
              })}
            >
              <Text style={[styles.actionBtnText, { color: Colors.success }]}>💳 Record Payment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.bgInput, borderColor: Colors.warning }]}
            onPress={() => navigation.navigate('PurchaseReturn', {
              invoiceId: invoice.id,
              supplierId: invoice.supplier_id,
              supplierName: invoice.supplier_name,
              items: invoice.items,
            })}
          >
            <Text style={[styles.actionBtnText, { color: Colors.warning }]}>↩️ Purchase Return</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Pay Button */}
      {invoice.status !== 'paid' && (
        <View style={[styles.stickyBar, { bottom: 85 + Math.max(insets.bottom, 8) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyLabel}>Balance Due</Text>
            <Text style={styles.stickyAmt}>{formatCurrency(invoice.balance_due)}</Text>
          </View>
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => navigation.navigate('AddSupplierPayment', {
              supplierId: invoice.supplier_id,
              supplierName: invoice.supplier_name,
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoice_number,
              maxAmount: invoice.balance_due,
            })}
          >
            <Text style={styles.payBtnText}>Pay Now →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  headerSub: { fontSize: 11, color: Colors.textGray },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '800' },
  summaryCard: { backgroundColor: Colors.bgCard, margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2 },
  summaryRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 10, color: Colors.textGray, fontWeight: '600', marginBottom: 2 },
  summaryVal: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  notes: { fontSize: 13, color: Colors.textGray, marginTop: 8, fontStyle: 'italic' },
  card: { backgroundColor: Colors.bgCard, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 12 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  lineName: { fontSize: 13, fontWeight: '600', color: Colors.textWhite },
  lineDetail: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  lineTotal: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: Colors.textGray, fontWeight: '600' },
  totalVal: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  grandRow: { paddingTop: 10, marginTop: 4 },
  grandLabel: { fontSize: 15, fontWeight: '800', color: Colors.textWhite },
  grandVal: { fontSize: 17, fontWeight: '800', color: Colors.primaryLight },
  actionBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10, backgroundColor: Colors.bgInput },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border, padding: 16 },
  stickyLabel: { fontSize: 11, color: Colors.textGray, fontWeight: '600' },
  stickyAmt: { fontSize: 18, fontWeight: '800', color: Colors.error },
  payBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  payBtnText: { color: Colors.textWhite, fontWeight: '800', fontSize: 14 },
});

