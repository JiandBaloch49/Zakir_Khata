import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { getStockItemsByUserId } from '../../services/database/stockDb';
import { PurchaseOrderItem } from '../../types/purchase.types';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { formatCurrency, rupeesToPaisa, paisaToRupeesString } from '../../utils/calculations';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

interface CartItem extends Omit<PurchaseOrderItem, 'id' | 'po_id' | 'received_qty' | 'is_deleted'> {
  tempId: string;
}

export const CreatePurchaseOrderModal = ({ navigation, route }: any) => {
  const initSupplierId = route?.params?.supplierId;
  const initSupplierName = route?.params?.supplierName;
  const { user } = useAuthStore();
  const { createOrder } = usePurchaseStore();
  const { suppliers, loadSuppliers } = useSupplierStore();

  const [supplierId, setSupplierId] = useState(initSupplierId ?? '');
  const [supplierName, setSupplierName] = useState(initSupplierName ?? '');
  const [orderDate, setOrderDate] = useState(todayDate());
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Stock search
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(!initSupplierId);

  // Load suppliers if not initialized
  React.useEffect(() => {
    if (user?.id && suppliers.length === 0) loadSuppliers(user.id);
  }, [user?.id]);

  const searchStock = useCallback(async (q: string) => {
    setStockSearch(q);
    if (!q.trim() || !user?.id) { setStockResults([]); return; }
    setSearchLoading(true);
    try {
      const items = await getStockItemsByUserId(user.id);
      setStockResults(items.filter(i => i.name_en?.toLowerCase().includes(q.toLowerCase())).slice(0, 8));
    } catch { setStockResults([]); }
    finally { setSearchLoading(false); }
  }, [user?.id]);

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.stock_item_id === item.id);
    if (existing) {
      setCart(prev => prev.map(c => c.tempId === existing.tempId
        ? { ...c, quantity: c.quantity + 1, line_total: (c.quantity + 1) * c.unit_cost }
        : c));
    } else {
      const cost = item.purchase_price ?? item.selling_price ?? 0;
      setCart(prev => [...prev, {
        tempId: `tmp_${Date.now()}`,
        stock_item_id: item.id,
        item_name: item.name_en,
        quantity: 1,
        unit_cost: cost,
        line_total: cost,
      }]);
    }
    setStockSearch('');
    setStockResults([]);
  };

  const updateQty = (tempId: string, qty: number) => {
    if (qty <= 0) { removeItem(tempId); return; }
    setCart(prev => prev.map(c => c.tempId === tempId
      ? { ...c, quantity: qty, line_total: qty * c.unit_cost }
      : c));
  };

  const updateCost = (tempId: string, cost: number) => {
    setCart(prev => prev.map(c => c.tempId === tempId
      ? { ...c, unit_cost: cost, line_total: c.quantity * cost }
      : c));
  };

  const removeItem = (tempId: string) => setCart(prev => prev.filter(c => c.tempId !== tempId));

  const total = cart.reduce((s, i) => s + i.line_total, 0);

  const handleSubmit = async () => {
    if (!supplierId) { Alert.alert('Error', 'Please select a supplier'); return; }
    if (cart.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    if (!user) return;
    setLoading(true);
    try {
      const items = cart.map(({ tempId, ...item }) => item);
      const po = await createOrder(user.id, supplierId, items, orderDate, expectedDate || undefined, notes || undefined);
      Alert.alert('PO Created', `Purchase Order PO-${String(po.po_number).padStart(4, '0')} created successfully.`, [
        { text: 'View', onPress: () => { navigation.goBack(); navigation.navigate('PurchaseOrderDetail', { orderId: po.id }); } },
        { text: 'Done', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to create purchase order.');
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
        <Text style={styles.headerTitle}>Create Purchase Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>

          {/* Supplier */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supplier *</Text>
            {supplierId && !showSupplierPicker ? (
              <TouchableOpacity style={styles.selectedSupplier} onPress={() => setShowSupplierPicker(true)}>
                <Text style={styles.selectedSupplierName}>{supplierName}</Text>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            ) : (
              <View>
                {suppliers.map(s => (
                  <TouchableOpacity key={s.id} style={styles.supplierOption}
                    onPress={() => { setSupplierId(s.id); setSupplierName(s.name); setShowSupplierPicker(false); }}
                  >
                    <Text style={styles.supplierOptName}>{s.name}</Text>
                    {s.business_name && <Text style={styles.supplierOptBiz}>{s.business_name}</Text>}
                  </TouchableOpacity>
                ))}
                {suppliers.length === 0 && (
                  <TouchableOpacity style={styles.addSupplierHint} onPress={() => navigation.navigate('AddSupplierModal')}>
                    <Text style={styles.addSupplierHintText}>+ Add Supplier First</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Dates */}
          <View style={styles.row2col}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.sectionTitle}>Order Date</Text>
              <DateField style={styles.input} value={orderDate} onChange={setOrderDate} />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.sectionTitle}>Expected Date</Text>
              <DateField style={styles.input} value={expectedDate} onChange={setExpectedDate} placeholder="Optional" />
            </View>
          </View>

          {/* Item Search */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Items</Text>
            <TextInput
              style={styles.input}
              placeholder="🔍 Search stock items..."
              value={stockSearch}
              onChangeText={searchStock}
              placeholderTextColor={Colors.textGray}
            />
            {searchLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />}
            {stockResults.map(item => (
              <TouchableOpacity key={item.id} style={styles.stockResult} onPress={() => addToCart(item)}>
                <Text style={styles.stockResultName}>{item.name_en}</Text>
                <Text style={styles.stockResultDetail}>Stock: {item.quantity} | Cost: {item.purchase_price != null ? formatCurrency(item.purchase_price) : '—'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cart */}
          {cart.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Items ({cart.length})</Text>
              {cart.map(item => (
                <View key={item.tempId} style={styles.cartItem}>
                  <Text style={styles.cartItemName} numberOfLines={1}>{item.item_name}</Text>
                  <View style={styles.cartItemControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.tempId, item.quantity - 1)}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyVal}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.tempId, item.quantity + 1)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                    <Text style={styles.cartX}>×</Text>
                    <TextInput
                      style={styles.costInput}
                      value={paisaToRupeesString(item.unit_cost)}
                      onChangeText={v => updateCost(item.tempId, rupeesToPaisa(v) ?? 0)}
                      keyboardType="decimal-pad"
                      placeholderTextColor={Colors.textGray}
                    />
                    <TouchableOpacity onPress={() => removeItem(item.tempId)}>
                      <Text style={{ color: Colors.error, fontSize: 18, marginLeft: 8 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.lineTotal}>Rs. {item.line_total.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Order Total</Text>
                <Text style={styles.totalAmt}>Rs. {total.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={notes} onChangeText={setNotes}
              placeholder="Any notes for this order..."
              placeholderTextColor={Colors.textGray}
              multiline numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>📦 CREATE PURCHASE ORDER</Text>}
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
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textGray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textWhite
  },
  row2col: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  selectedSupplier: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: Colors.bgInput, borderRadius: 10, borderWidth: 1, borderColor: Colors.border
  },
  selectedSupplierName: { fontSize: 15, fontWeight: '700', color: Colors.primaryLight },
  changeText: { fontSize: 13, color: Colors.textGray, fontWeight: '600' },
  supplierOption: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.bgInput },
  supplierOptName: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  supplierOptBiz: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  addSupplierHint: { padding: 12, alignItems: 'center' },
  addSupplierHintText: { color: Colors.primaryLight, fontWeight: '700' },
  stockResult: { padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stockResultName: { fontSize: 14, fontWeight: '600', color: Colors.textWhite },
  stockResultDetail: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  cartItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cartItemName: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 6 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  qtyBtn: { width: 32, height: 32, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, color: Colors.primaryLight, fontWeight: '700' },
  qtyVal: { width: 36, textAlign: 'center', fontSize: 15, fontWeight: '700', color: Colors.textWhite },
  cartX: { fontSize: 14, color: Colors.textGray, marginHorizontal: 6 },
  costInput: {
    width: 80, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, textAlign: 'center', color: Colors.textWhite
  },
  lineTotal: { fontSize: 12, color: Colors.textGray, marginTop: 4, textAlign: 'right', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  totalAmt: { fontSize: 16, fontWeight: '800', color: Colors.primaryLight },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
});

