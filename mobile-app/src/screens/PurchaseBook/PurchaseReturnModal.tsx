import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { PurchaseInvoiceItem, PurchaseReturnItem } from '../../types/purchase.types';
import { formatCurrency } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

interface ReturnCartItem extends Omit<PurchaseReturnItem, 'id' | 'return_id'> {
  tempId: string;
  maxQty: number;
}

export const PurchaseReturnModal = ({ navigation, route }: any) => {
  const {
    invoiceId, supplierId, supplierName,
    items = [] as PurchaseInvoiceItem[]
  } = route.params;

  const { user } = useAuthStore();
  const { createReturn } = usePurchaseStore();

  const [returnDate, setReturnDate] = useState(todayDate());
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<Record<string, { qty: string; checked: boolean }>>(
    Object.fromEntries(items.map((i: PurchaseInvoiceItem) => [i.id, { qty: String(i.quantity), checked: false }]))
  );
  const [loading, setLoading] = useState(false);

  const checkedItems = items.filter((i: PurchaseInvoiceItem) => selected[i.id]?.checked);
  const totalRefund = checkedItems.reduce((s: number, i: PurchaseInvoiceItem) => {
    const qty = parseFloat(selected[i.id]?.qty ?? '0') || 0;
    return s + (qty * i.unit_cost);
  }, 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (checkedItems.length === 0) { Alert.alert('Error', 'Select at least one item to return'); return; }

    const returnItems: Omit<PurchaseReturnItem, 'id' | 'return_id'>[] = checkedItems.map((i: PurchaseInvoiceItem) => {
      const qty = parseFloat(selected[i.id]?.qty ?? '0') || 0;
      return {
        stock_item_id: i.stock_item_id,
        item_name: i.item_name,
        quantity: qty,
        unit_cost: i.unit_cost,
        line_total: qty * i.unit_cost,
      };
    });

    setLoading(true);
    try {
      await createReturn(user.id, invoiceId, supplierId, returnItems, returnDate, reason.trim() || undefined);
      Alert.alert(
        '↩️ Return Recorded',
        `Return of ${formatCurrency(totalRefund)} recorded. Stock has been reduced.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to record return. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Purchase Return</Text>
          <Text style={styles.headerSub}>to {supplierName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>↩️ Select items to return. Stock will be reduced automatically.</Text>
        </View>

        {/* Return Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Return Date</Text>
          <DateField style={styles.input} value={returnDate} onChange={setReturnDate} />
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Items to Return</Text>
          {items.map((item: PurchaseInvoiceItem) => {
            const sel = selected[item.id];
            const qty = parseFloat(sel?.qty ?? '0') || 0;
            return (
              <View key={item.id} style={[styles.itemRow, sel?.checked && styles.itemRowActive]}>
                <TouchableOpacity
                  style={[styles.checkbox, sel?.checked && styles.checkboxActive]}
                  onPress={() => setSelected(p => ({ ...p, [item.id]: { ...p[item.id], checked: !p[item.id]?.checked } }))}
                >
                  {sel?.checked && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemDetail}>Unit cost: {formatCurrency(item.unit_cost)}</Text>
                </View>

                {sel?.checked && (
                  <View style={styles.qtyWrap}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setSelected(p => ({ ...p, [item.id]: { ...p[item.id], qty: String(Math.max(1, parseFloat(p[item.id]?.qty ?? '1') - 1)) } }))}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyInput}
                      value={sel.qty}
                      onChangeText={v => setSelected(p => ({ ...p, [item.id]: { ...p[item.id], qty: v } }))}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      placeholderTextColor={Colors.textGray}
                    />
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setSelected(p => ({ ...p, [item.id]: { ...p[item.id], qty: String(Math.min(item.quantity, parseFloat(p[item.id]?.qty ?? '0') + 1)) } }))}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {sel?.checked && qty > 0 && (
                  <Text style={styles.lineRefund}>{formatCurrency(qty * item.unit_cost)}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.label}>Reason for Return</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={reason} onChangeText={setReason}
            placeholder="e.g. Defective goods, wrong items, excess stock..."
            placeholderTextColor={Colors.textGray}
            multiline numberOfLines={3}
          />
        </View>

        {/* Refund Summary */}
        {totalRefund > 0 && (
          <View style={styles.refundSummary}>
            <Text style={styles.refundLabel}>Total Refund Amount</Text>
            <Text style={styles.refundAmt}>{formatCurrency(totalRefund)}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading || checkedItems.length === 0}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>↩️ CONFIRM RETURN</Text>}
        </TouchableOpacity>
      </ScreenContainer>
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
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textWhite },
  headerSub: { fontSize: 11, color: Colors.textGray },
  form: { padding: 16, paddingBottom: 40 },
  notice: { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  noticeText: { fontSize: 13, color: Colors.warning, lineHeight: 20 },
  section: {
    backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2
  },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textGray, marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textWhite
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10, flexWrap: 'wrap' },
  itemRowActive: { backgroundColor: Colors.bgInput, borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  checkmark: { color: Colors.textWhite, fontSize: 14, fontWeight: '800' },
  itemName: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  itemDetail: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 30, height: 30, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, color: Colors.warning, fontWeight: '700' },
  qtyInput: {
    width: 50, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, textAlign: 'center', fontSize: 15, fontWeight: '700', paddingVertical: 4, color: Colors.textWhite
  },
  lineRefund: { fontSize: 13, fontWeight: '800', color: Colors.warning },
  refundSummary: { backgroundColor: Colors.bgInput, borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  refundLabel: { fontSize: 12, color: Colors.textGray, fontWeight: '600', marginBottom: 4 },
  refundAmt: { fontSize: 24, fontWeight: '800', color: Colors.warning },
  submitBtn: { backgroundColor: Colors.warning, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: Colors.warning, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  submitText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
});

