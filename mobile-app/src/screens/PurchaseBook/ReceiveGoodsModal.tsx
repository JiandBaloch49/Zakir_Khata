import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { PurchaseOrderItem } from '../../types/purchase.types';
import { formatCurrency } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';

export const ReceiveGoodsModal = ({ navigation, route }: any) => {
  const { orderId, items = [] } = route.params as { orderId: string; items: PurchaseOrderItem[] };
  const { user } = useAuthStore();
  const { receiveGoods } = usePurchaseStore();

  // Local receipt qty per item (keyed by item.id)
  const [received, setReceived] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i: PurchaseOrderItem) => [i.id, String(i.quantity - i.received_qty)]))
  );
  const [loading, setLoading] = useState(false);

  const pending = items.filter((i: PurchaseOrderItem) => i.received_qty < i.quantity);

  const handleSubmit = async () => {
    if (!user) return;
    const receipts = pending
      .map((i: PurchaseOrderItem) => ({
        itemId: i.id,
        stockItemId: i.stock_item_id,
        itemName: i.item_name,
        receivedQty: parseFloat(received[i.id] ?? '0') || 0,
        unitCost: i.unit_cost,
      }))
      .filter(r => r.receivedQty > 0);

    if (receipts.length === 0) {
      Alert.alert('Error', 'Enter received quantity for at least one item.');
      return;
    }

    setLoading(true);
    try {
      await receiveGoods(orderId, user.id, receipts);
      Alert.alert(
        '✅ Goods Received',
        `${receipts.length} item(s) received. Stock has been updated automatically.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to record receipt. Please try again.');
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
        <Text style={styles.headerTitle}>Receive Goods</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              📦 Enter the quantity received for each item. Stock will be updated automatically.
            </Text>
          </View>

          {pending.length === 0 ? (
            <View style={styles.allReceived}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={styles.allReceivedText}>All items already received</Text>
            </View>
          ) : (
            pending.map((item: PurchaseOrderItem) => {
              const remaining = item.quantity - item.received_qty;
              const qty = parseFloat(received[item.id] ?? '0');
              const lineTotal = qty * item.unit_cost;
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.item_name}</Text>
                    {item.stock_item_id && (
                      <View style={styles.stockBadge}>
                        <Text style={styles.stockBadgeText}>Stock ✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemDetail}>
                    Ordered: {item.quantity} | Previously received: {item.received_qty} | Remaining: {remaining}
                  </Text>
                  <Text style={styles.itemCost}>Unit Cost: {formatCurrency(item.unit_cost)}</Text>

                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => setReceived(p => ({ ...p, [item.id]: String(Math.max(0, parseFloat(p[item.id] ?? '0') - 1)) }))}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.qtyInput}
                      value={received[item.id]}
                      onChangeText={v => setReceived(p => ({ ...p, [item.id]: v }))}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      placeholderTextColor={Colors.textGray}
                    />

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => setReceived(p => ({ ...p, [item.id]: String(Math.min(remaining, parseFloat(p[item.id] ?? '0') + 1)) }))}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.allBtn}
                      onPress={() => setReceived(p => ({ ...p, [item.id]: String(remaining) }))}
                    >
                      <Text style={styles.allBtnText}>All</Text>
                    </TouchableOpacity>
                  </View>

                  {qty > 0 && (
                    <Text style={styles.lineTotal}>
                      Receiving {qty} × {formatCurrency(item.unit_cost)} = {formatCurrency(lineTotal)}
                    </Text>
                  )}
                </View>
              );
            })
          )}

          {pending.length > 0 && (
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>✅ CONFIRM RECEIPT & UPDATE STOCK</Text>
              }
            </TouchableOpacity>
          )}
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  form: { padding: 16, paddingBottom: 40 },
  notice: {
    backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  noticeText: { fontSize: 13, color: Colors.primaryLight, lineHeight: 20 },
  allReceived: { alignItems: 'center', paddingVertical: 60 },
  allReceivedText: { fontSize: 17, fontWeight: '700', color: Colors.success, marginTop: 12 },
  itemCard: {
    backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.textWhite, flex: 1 },
  stockBadge: { backgroundColor: Colors.bgInput, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  stockBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  itemDetail: { fontSize: 12, color: Colors.textGray, marginBottom: 2 },
  itemCost: { fontSize: 12, color: Colors.textGray, fontWeight: '600', marginBottom: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 38, height: 38, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { fontSize: 20, color: Colors.primaryLight, fontWeight: '700' },
  qtyInput: {
    flex: 1, backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: '800',
    paddingVertical: 8, color: Colors.textWhite,
  },
  allBtn: {
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10,
  },
  allBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },
  lineTotal: { fontSize: 13, fontWeight: '700', color: Colors.success, marginTop: 8, textAlign: 'right' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  submitText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
});

