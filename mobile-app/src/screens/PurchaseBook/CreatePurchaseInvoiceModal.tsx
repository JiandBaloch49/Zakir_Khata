import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { getStockItemsByUserId } from '../../services/database/stockDb';
import { PurchaseInvoiceItem, PurchaseOrderItem } from '../../types/purchase.types';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { formatCurrency, rupeesToPaisa, paisaToRupeesString } from '../../utils/calculations';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

interface CartItem extends Omit<PurchaseInvoiceItem, 'id' | 'invoice_id' | 'is_deleted'> {
  tempId: string;
}

export const CreatePurchaseInvoiceModal = ({ navigation, route }: any) => {
  const {
    supplierId: initSupplierId, supplierName: initSupplierName,
    poId, items: poItems
  } = route?.params ?? {};

  const { user } = useAuthStore();
  const { createInvoice } = usePurchaseStore();
  const { suppliers, loadSuppliers } = useSupplierStore();

  const [supplierId, setSupplierId] = useState(initSupplierId ?? '');
  const [supplierName, setSupplierName] = useState(initSupplierName ?? '');
  const [showSupplierPicker, setShowSupplierPicker] = useState(!initSupplierId);
  const [invoiceDate, setInvoiceDate] = useState(todayDate());
  const [dueDate, setDueDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Pre-fill cart from PO items if provided
  useEffect(() => {
    if (poItems && Array.isArray(poItems)) {
      setCart(poItems.map((i: PurchaseOrderItem, idx: number) => ({
        tempId: `pre_${idx}`,
        stock_item_id: i.stock_item_id,
        item_name: i.item_name,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        line_total: i.line_total,
      })));
    }
  }, []);

  useEffect(() => {
    if (user?.id && suppliers.length === 0) loadSuppliers(user.id);
  }, [user?.id]);

  const searchStock = async (q: string) => {
    setStockSearch(q);
    if (!q.trim() || !user?.id) { setStockResults([]); return; }
    const items = await getStockItemsByUserId(user.id);
    setStockResults(items.filter(i => i.name_en?.toLowerCase().includes(q.toLowerCase())).slice(0, 6));
  };

  const addToCart = (item: any) => {
    const cost = item.purchase_price ?? item.selling_price ?? 0;
    setCart(prev => [...prev, { tempId: `tmp_${Date.now()}`, stock_item_id: item.id, item_name: item.name_en, quantity: 1, unit_cost: cost, line_total: cost }]);
    setStockSearch(''); setStockResults([]);
  };

  const updateItem = (tempId: string, field: 'quantity' | 'unit_cost', val: number) => {
    setCart(prev => prev.map(c => {
      if (c.tempId !== tempId) return c;
      const q = field === 'quantity' ? val : c.quantity;
      const p = field === 'unit_cost' ? val : c.unit_cost;
      return { ...c, [field]: val, line_total: q * p };
    }));
  };

  const removeItem = (tempId: string) => setCart(prev => prev.filter(c => c.tempId !== tempId));

  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const disc = rupeesToPaisa(discountAmount) ?? 0;
  const tax = rupeesToPaisa(taxAmount) ?? 0;
  const total = subtotal - disc + tax;

  const handleSubmit = async () => {
    if (!supplierId) { Alert.alert('Error', 'Please select a supplier'); return; }
    if (cart.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    if (!user) return;
    setLoading(true);
    try {
      const items = cart.map(({ tempId, ...i }) => i);
      await createInvoice(user.id, supplierId, items, invoiceDate, {
        poId: poId ?? undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        discountAmount: disc,
        taxAmount: tax,
        notes: notes.trim() || undefined,
      });
      Alert.alert('✅ Invoice Created', 'Purchase invoice created and stock updated.', [
        { text: 'Done', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to create invoice. Please try again.');
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
        <Text style={styles.headerTitle}>{poId ? 'Invoice from PO' : 'New Purchase Invoice'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>

          {/* Supplier */}
          <View style={styles.section}>
            <Text style={styles.label}>Supplier *</Text>
            {supplierId && !showSupplierPicker ? (
              <TouchableOpacity style={styles.selectedSupplier} onPress={() => setShowSupplierPicker(true)}>
                <Text style={styles.selectedName}>{supplierName}</Text>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            ) : (
              suppliers.map(s => (
                <TouchableOpacity key={s.id} style={styles.supplierOpt}
                  onPress={() => { setSupplierId(s.id); setSupplierName(s.name); setShowSupplierPicker(false); }}
                >
                  <Text style={styles.supplierOptName}>{s.name}</Text>
                  {s.business_name && <Text style={styles.supplierOptBiz}>{s.business_name}</Text>}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Invoice Details */}
          <View style={styles.section}>
            <Text style={styles.label}>Invoice Number (auto if blank)</Text>
            <TextInput style={styles.input} value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="e.g. INV-2025-001" placeholderTextColor={Colors.textGray} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Invoice Date *</Text>
                <DateField style={styles.input} value={invoiceDate} onChange={setInvoiceDate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Due Date</Text>
                <DateField style={styles.input} value={dueDate} onChange={setDueDate} placeholder="Optional" />
              </View>
            </View>
          </View>

          {/* Item Search */}
          <View style={styles.section}>
            <Text style={styles.label}>Add Items</Text>
            <TextInput style={styles.input} placeholder="🔍 Search stock items..." value={stockSearch} onChangeText={searchStock} placeholderTextColor={Colors.textGray} />
            {stockResults.map(item => (
              <TouchableOpacity key={item.id} style={styles.stockResult} onPress={() => addToCart(item)}>
                <Text style={styles.stockResultName}>{item.name_en}</Text>
                <Text style={styles.stockResultDetail}>Cost: {item.purchase_price != null ? formatCurrency(item.purchase_price) : '—'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cart */}
          {cart.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Items ({cart.length})</Text>
              {cart.map(item => (
                <View key={item.tempId} style={styles.cartRow}>
                  <Text style={styles.cartName} numberOfLines={1}>{item.item_name}</Text>
                  <View style={styles.cartControls}>
                    <TextInput
                      style={styles.smallInput}
                      value={String(item.quantity)}
                      onChangeText={v => updateItem(item.tempId, 'quantity', parseFloat(v) || 0)}
                      keyboardType="decimal-pad"
                      placeholder="Qty"
                      placeholderTextColor={Colors.textGray}
                    />
                    <Text style={styles.cartX}>×</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={paisaToRupeesString(item.unit_cost)}
                      onChangeText={v => updateItem(item.tempId, 'unit_cost', rupeesToPaisa(v) ?? 0)}
                      keyboardType="decimal-pad"
                      placeholder="Cost"
                      placeholderTextColor={Colors.textGray}
                    />
                    <Text style={styles.cartLine}>=  {formatCurrency(item.line_total)}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.tempId)}>
                      <Text style={{ color: Colors.error, fontSize: 18, marginLeft: 6 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Totals */}
              <View style={styles.totals}>
                <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>Rs. {subtotal.toFixed(2)}</Text></View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount (Rs.)</Text>
                  <TextInput style={styles.inlineInput} value={discountAmount} onChangeText={setDiscountAmount} keyboardType="decimal-pad" placeholderTextColor={Colors.textGray} />
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax (Rs.)</Text>
                  <TextInput style={styles.inlineInput} value={taxAmount} onChangeText={setTaxAmount} keyboardType="decimal-pad" placeholderTextColor={Colors.textGray} />
                </View>
                <View style={[styles.totalRow, { paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }]}>
                  <Text style={[styles.totalLabel, { fontSize: 15, fontWeight: '800', color: Colors.textWhite }]}>TOTAL</Text>
                  <Text style={[styles.totalVal, { fontSize: 16, fontWeight: '800', color: Colors.primaryLight }]}>Rs. {total.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Any notes..." placeholderTextColor={Colors.textGray} />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>🧾 CREATE INVOICE</Text>}
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
  form: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2
  },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textGray, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textWhite
  },
  selectedSupplier: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.bgInput,
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border
  },
  selectedName: { fontSize: 14, fontWeight: '700', color: Colors.primaryLight },
  changeText: { fontSize: 13, color: Colors.textGray },
  supplierOpt: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.bgInput },
  supplierOptName: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  supplierOptBiz: { fontSize: 12, color: Colors.textGray },
  stockResult: { padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stockResultName: { fontSize: 14, fontWeight: '600', color: Colors.textWhite },
  stockResultDetail: { fontSize: 12, color: Colors.textGray },
  cartRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cartName: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 6 },
  cartControls: { flexDirection: 'row', alignItems: 'center' },
  smallInput: {
    width: 64, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6, fontSize: 13, textAlign: 'center', color: Colors.textWhite
  },
  cartX: { fontSize: 14, color: Colors.textGray, marginHorizontal: 6 },
  cartLine: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.primaryLight, marginLeft: 6 },
  totals: { marginTop: 12, paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  totalLabel: { fontSize: 13, color: Colors.textGray, fontWeight: '600' },
  totalVal: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  inlineInput: {
    width: 90, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, textAlign: 'right', color: Colors.textWhite
  },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
});

