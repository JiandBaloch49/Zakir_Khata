import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { formatCurrency } from '../../utils/calculations';
import { PurchaseOrderItem, POStatus } from '../../types/purchase.types';
import { Colors } from '../../theme';

const STATUS_ACTIONS: { from: POStatus[]; to: POStatus; label: string; color: string }[] = [
  { from: ['draft'], to: 'sent', label: 'Mark as Sent', color: '#60A5FA' },
  { from: ['sent', 'partial'], to: 'received', label: 'Mark All Received', color: Colors.success },
  { from: ['draft', 'sent', 'partial'], to: 'cancelled', label: 'Cancel Order', color: Colors.error },
];

export const PurchaseOrderDetailScreen = ({ navigation, route }: any) => {
  const { orderId } = route.params;
  const { user } = useAuthStore();
  const { selectedOrder: order, loading, loadOrderById, updateOrderStatus, receiveGoods } = usePurchaseStore();

  const load = useCallback(() => loadOrderById(orderId), [orderId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const handleStatusChange = (to: POStatus) => {
    const label = STATUS_ACTIONS.find(a => a.to === to)?.label ?? 'Update';
    Alert.alert('Confirm', `${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await updateOrderStatus(orderId, user!.id, to);
          await load();
        }
      }
    ]);
  };

  const handleCreateInvoice = () => {
    if (!order) return;
    navigation.navigate('CreatePurchaseInvoice', {
      supplierId: order.supplier_id,
      supplierName: order.supplier_name,
      poId: order.id,
      items: order.items,
    });
  };

  if (loading || !order) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const availableActions = STATUS_ACTIONS.filter(a => a.from.includes(order.status));
  const totalReceived = order.items?.reduce((s, i) => s + (i.received_qty * i.unit_cost), 0) ?? 0;

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      draft:     { bg: '#374151', fg: '#D1D5DB' },
      sent:      { bg: '#1E3A8A', fg: '#93C5FD' },
      partial:   { bg: '#7C2D12', fg: '#FDBA74' },
      received:  { bg: '#064E3B', fg: '#6EE7B7' },
      cancelled: { bg: '#7F1D1D', fg: '#FCA5A5' },
    };
    const c = colors[status] ?? colors.draft;
    return (
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.fg }]}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>PO-{String(order.po_number).padStart(4, '0')}</Text>
          <Text style={styles.headerSub}>{order.supplier_name}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 135 }}>
        {/* Meta */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Order Date</Text>
              <Text style={styles.metaVal}>{order.order_date}</Text>
            </View>
            {order.expected_date && (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Expected Date</Text>
                <Text style={styles.metaVal}>{order.expected_date}</Text>
              </View>
            )}
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Total Value</Text>
              <Text style={[styles.metaVal, { color: Colors.primaryLight, fontWeight: '800' }]}>{formatCurrency(order.total)}</Text>
            </View>
          </View>
          {order.notes && <Text style={styles.notesText}>📝 {order.notes}</Text>}
        </View>

        {/* Progress Bar */}
        {(order.status === 'partial' || order.status === 'received') && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>
              Received: {formatCurrency(totalReceived)} / {formatCurrency(order.total)}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (totalReceived / order.total) * 100)}%` }]} />
            </View>
          </View>
        )}

        {/* Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.cardTitle}>Order Items</Text>
          {(order.items ?? []).map((item: PurchaseOrderItem) => {
            const receivedPct = item.quantity > 0 ? (item.received_qty / item.quantity) * 100 : 0;
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemDetail}>
                    Ordered: {item.quantity} × {formatCurrency(item.unit_cost)} = {formatCurrency(item.line_total)}
                  </Text>
                  <Text style={[styles.itemReceived, { color: receivedPct >= 100 ? Colors.success : Colors.warning }]}>
                    Received: {item.received_qty} / {item.quantity}
                  </Text>
                </View>
                <View style={[styles.itemStatusDot, { backgroundColor: receivedPct >= 100 ? Colors.success : receivedPct > 0 ? Colors.warning : Colors.border }]} />
              </View>
            );
          })}
        </View>

        {/* Action Buttons */}
        {availableActions.length > 0 && (
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Actions</Text>
            {availableActions.map(action => (
              <TouchableOpacity
                key={action.to}
                style={[styles.actionBtn, { borderColor: action.color, backgroundColor: Colors.bgInput }]}
                onPress={() => handleStatusChange(action.to)}
              >
                <Text style={[styles.actionBtnText, { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
            {(order.status === 'sent' || order.status === 'partial') && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: Colors.success, backgroundColor: Colors.bgInput }]}
                onPress={() => navigation.navigate('ReceiveGoods', { orderId: order.id, items: order.items })}
              >
                <Text style={[styles.actionBtnText, { color: Colors.success }]}>📦 Receive Goods</Text>
              </TouchableOpacity>
            )}
            {order.status !== 'cancelled' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: Colors.primaryLight, backgroundColor: Colors.bgInput }]}
                onPress={handleCreateInvoice}
              >
                <Text style={[styles.actionBtnText, { color: Colors.primaryLight }]}>🧾 Create Invoice from PO</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  metaCard: { backgroundColor: Colors.bgCard, margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 10, color: Colors.textGray, fontWeight: '600', marginBottom: 2 },
  metaVal: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  notesText: { fontSize: 13, color: Colors.textGray, marginTop: 8, fontStyle: 'italic' },
  progressCard: { backgroundColor: Colors.bgCard, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2 },
  progressLabel: { fontSize: 12, color: Colors.textGray, fontWeight: '600', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: Colors.bgInput, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  itemsCard: { backgroundColor: Colors.bgCard, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  itemDetail: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  itemReceived: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  itemStatusDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 12 },
  actionsCard: { backgroundColor: Colors.bgCard, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.2, elevation: 2 },
  actionBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
});

