import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useAuthStore } from '../../store/authStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useActivityStore } from '../../store/useActivityStore';
import { PaymentMethod } from '../../types/supplier.types';
import { rupeesToPaisa, formatCurrency } from '../../utils/calculations';
import { Colors } from '../../theme';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

const METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { key: 'cheque', label: 'Cheque', icon: '📜' },
  { key: 'online', label: 'Online / UPI', icon: '📱' },
];

export const AddSupplierPaymentModal = ({ navigation, route }: any) => {
  const { supplierId, supplierName, invoiceId, invoiceNumber, maxAmount } = route.params;
  const { user } = useAuthStore();
  const { addPayment } = useSupplierStore();
  const { logActivity } = useActivityStore();

  const [amount, setAmount] = useState(maxAmount ? String(maxAmount) : '');
  const [paymentDate, setPaymentDate] = useState(todayDate());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const paisa = rupeesToPaisa(amount);
    if (!amount.trim()) e.amount = 'Amount is required';
    else if (paisa === null) e.amount = 'Enter a valid positive amount';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) e.date = 'Date must be YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;
    const paisa = rupeesToPaisa(amount)!;
    setLoading(true);
    try {
      const payment = await addPayment({
        supplier_id: supplierId,
        user_id: user.id,
        invoice_id: invoiceId ?? undefined,
        amount: paisa,
        payment_date: paymentDate,
        payment_method: method,
        reference_number: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      await logActivity({
        user_id: user.id,
        user_name: user.name || 'User',
        action: 'create',
        entity_type: 'supplier',
        entity_id: payment.id,
        description: `Payment to ${supplierName}: ${formatCurrency(paisa)}`,
        amount: paisa,
      });

      navigation.goBack();
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to record payment.');
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
          <Text style={styles.headerTitle}>Record Payment</Text>
          <Text style={styles.headerSub}>to {supplierName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={false} contentContainerStyle={styles.form}>
        {/* Amount */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Amount (Rs.) *</Text>
          <View style={[styles.amountRow, errors.amount ? styles.inputErr : null]}>
            <Text style={styles.rsSign}>Rs.</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={Colors.textGray}
              value={amount}
              onChangeText={t => { setAmount(t); setErrors(p => ({ ...p, amount: '' })); }}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
          {!!errors.amount && <Text style={styles.errText}>{errors.amount}</Text>}
        </View>

        {/* Date */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Payment Date *</Text>
          <DateField
            style={[styles.input, errors.date ? styles.inputErr : null]}
            value={paymentDate}
            onChange={d => { setPaymentDate(d); setErrors(p => ({ ...p, date: '' })); }}
          />
          {!!errors.date && <Text style={styles.errText}>{errors.date}</Text>}
        </View>

        {/* Payment Method */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Payment Method</Text>
          <View style={styles.methodGrid}>
            {METHODS.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.methodBtn, method === m.key && styles.methodBtnActive]}
                onPress={() => setMethod(m.key)}
              >
                <Text style={styles.methodIcon}>{m.icon}</Text>
                <Text style={[styles.methodLabel, method === m.key && styles.methodLabelActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reference */}
        {(method === 'cheque' || method === 'bank_transfer' || method === 'online') && (
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Reference / Transaction ID</Text>
            <TextInput
              style={styles.input}
              value={reference}
              onChangeText={setReference}
              placeholder={method === 'cheque' ? 'Cheque number' : 'Transaction ID'}
              placeholderTextColor={Colors.textGray}
            />
          </View>
        )}

        {/* Notes */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            placeholderTextColor={Colors.textGray}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💳 RECORD PAYMENT</Text>}
        </TouchableOpacity>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  headerSub: { fontSize: 11, color: Colors.primaryLight },
  form: { padding: 20, paddingBottom: 40 },
  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textWhite,
  },
  inputErr: { borderColor: Colors.error },
  errText: { fontSize: 12, color: Colors.error, marginTop: 4 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14,
  },
  rsSign: { fontSize: 18, fontWeight: '700', color: Colors.primary, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: Colors.textWhite, paddingVertical: 12 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: Colors.bgInput, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  methodBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.bgCard },
  methodIcon: { fontSize: 18 },
  methodLabel: { fontSize: 13, fontWeight: '600', color: Colors.textGray },
  methodLabelActive: { color: Colors.primaryLight, fontWeight: '700' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
