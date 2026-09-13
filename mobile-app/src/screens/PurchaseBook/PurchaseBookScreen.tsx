import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Keyboard, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { PurchaseOrder, PurchaseInvoice } from '../../types/purchase.types';
import { formatCurrency } from '../../utils/calculations';
import { Colors } from '../../theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:     { bg: '#374151', text: '#D1D5DB' },
  sent:      { bg: '#1E3A8A', text: '#93C5FD' },
  partial:   { bg: '#7C2D12', text: '#FDBA74' },
  received:  { bg: '#064E3B', text: '#6EE7B7' },
  cancelled: { bg: '#7F1D1D', text: '#FCA5A5' },
  unpaid:    { bg: '#7F1D1D', text: '#FCA5A5' },
  paid:      { bg: '#064E3B', text: '#6EE7B7' },
};

const OrderCard = React.memo(({ item, onPress }: { item: PurchaseOrder; onPress: () => void }) => {
  const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.poNumber}>PO-{String(item.po_number).padStart(4, '0')}</Text>
          <Text style={styles.cardSub}>{item.supplier_name}</Text>
          <Text style={styles.cardDate}>{item.order_date}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.cardTotal}>{formatCurrency(item.total)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const InvoiceCard = React.memo(({ item, onPress }: { item: PurchaseInvoice; onPress: () => void }) => {
  const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.unpaid;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.poNumber}>#{item.invoice_number}</Text>
          <Text style={styles.cardSub}>{item.supplier_name}</Text>
          <Text style={styles.cardDate}>{item.invoice_date}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.cardTotal}>{formatCurrency(item.total)}</Text>
          {item.balance_due > 0 && (
            <Text style={styles.balDue}>Due: {formatCurrency(item.balance_due)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const PurchaseBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { orders, invoices, summary, loading, loadOrders, loadInvoices, loadSummary } = usePurchaseStore();
  const [tab, setTab] = useState<'orders' | 'invoices'>('orders');
  const [refreshing, setRefreshing] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([loadOrders(user.id), loadInvoices(user.id), loadSummary(user.id)]);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="PurchaseBook" />

      {/* Summary Tiles */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.tile}>
            <Text style={styles.tileVal}>{summary.totalOrders}</Text>
            <Text style={styles.tileLabel}>Total Orders</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileVal, { color: Colors.warning }]}>{summary.pendingOrders}</Text>
            <Text style={styles.tileLabel}>Pending</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileVal, { color: Colors.error, fontSize: 13 }]}>{formatCurrency(summary.totalOutstanding)}</Text>
            <Text style={styles.tileLabel}>Outstanding</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileVal, { color: Colors.success, fontSize: 13 }]}>{formatCurrency(summary.totalPaidThisMonth)}</Text>
            <Text style={styles.tileLabel}>Paid (Month)</Text>
          </View>
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'orders' && styles.tabActive]} onPress={() => setTab('orders')}>
          <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>📦 Orders ({orders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'invoices' && styles.tabActive]} onPress={() => setTab('invoices')}>
          <Text style={[styles.tabText, tab === 'invoices' && styles.tabTextActive]}>🧾 Invoices ({invoices.length})</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : tab === 'orders' ? (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 150 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.textWhite} />}
          renderItem={({ item }) => (
            <OrderCard item={item} onPress={() => navigation.navigate('PurchaseOrderDetail', { orderId: item.id })} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No Purchase Orders</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreatePurchaseOrder')}>
                <Text style={styles.emptyBtnText}>+ Create First PO</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 150 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.textWhite} />}
          renderItem={({ item }) => (
            <InvoiceCard item={item} onPress={() => navigation.navigate('PurchaseInvoiceDetail', { invoiceId: item.id })} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No Invoices Yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreatePurchaseInvoice', {})}>
                <Text style={styles.emptyBtnText}>+ Create Invoice</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      {!isKeyboardVisible && (
        <View style={[styles.fab, { bottom: 85 + Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate(tab === 'orders' ? 'CreatePurchaseOrder' : 'CreatePurchaseInvoice', {})}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  headerSub: { fontSize: 11, color: Colors.textGray },
  addBtn: { backgroundColor: 'rgba(0,166,81,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.primaryLight },
  addBtnText: { color: Colors.primaryLight, fontWeight: '700', fontSize: 13 },
  summaryRow: { flexDirection: 'row', padding: 12, gap: 6 },
  tile: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  tileVal: { fontSize: 14, fontWeight: '800', color: Colors.textWhite, marginBottom: 2 },
  tileLabel: { fontSize: 9, color: Colors.textGray, fontWeight: '600', textAlign: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primaryLight },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textGray },
  tabTextActive: { color: Colors.primaryLight, fontWeight: '800' },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  poNumber: { fontSize: 15, fontWeight: '800', color: Colors.textWhite },
  cardSub: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  cardDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardTotal: { fontSize: 15, fontWeight: '800', color: Colors.textWhite },
  balDue: { fontSize: 11, color: Colors.error, fontWeight: '600', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textGray, marginTop: 12 },
  emptyBtn: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  emptyBtnText: { color: Colors.textWhite, fontWeight: '700' },
  fab: { position: 'absolute', right: 20, bottom: 24 },
  fabBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  fabText: { fontSize: 28, color: Colors.textWhite, fontWeight: '300', lineHeight: 32 },
});

