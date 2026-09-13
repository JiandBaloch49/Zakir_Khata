import React, { useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { formatCurrency } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';

export const SupplierProfileScreen = ({ navigation, route }: any) => {
  const { supplierId } = route.params;
  const { selectedSupplier: supplier, payments, loading, loadSupplierById, deleteSupplier } = useSupplierStore();
  const { user } = useAuthStore();

  const load = useCallback(() => loadSupplierById(supplierId), [supplierId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const handleCall = () => supplier?.phone && Linking.openURL(`tel:${supplier.phone}`);
  const handleWhatsApp = () => {
    if (!supplier?.phone) return;
    const clean = supplier.phone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=92${clean.replace(/^0/, '')}`);
  };

  const handleDelete = () => {
    Alert.alert('Delete Supplier', 'This will delete the supplier. Existing invoices will remain.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteSupplier(supplierId, user.id);
          navigation.goBack();
        }
      }
    ]);
  };

  if (loading || !supplier) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const outstanding = supplier.outstanding_balance ?? 0;

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) =>
    value ? (
      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>{icon}</Text>
        <View>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Supplier Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddSupplierModal', { supplierId, edit: true })} style={styles.editBtn}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScreenContainer scrollable={true} hasTabBar={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{supplier.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.supplierName}>{supplier.name}</Text>
          {supplier.business_name && <Text style={styles.businessName}>{supplier.business_name}</Text>}
          {supplier.city && <Text style={styles.cityText}>📍 {supplier.city}</Text>}

          {/* Quick Actions */}
          {supplier.phone && (
            <View style={styles.quickActions}>
              <TouchableOpacity style={[styles.quickBtn, { backgroundColor: Colors.bgInput }]} onPress={handleCall}>
                <Text style={styles.quickIcon}>📞</Text>
                <Text style={[styles.quickLabel, { color: Colors.success }]}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickBtn, { backgroundColor: Colors.bgInput }]} onPress={handleWhatsApp}>
                <Text style={styles.quickIcon}>💬</Text>
                <Text style={[styles.quickLabel, { color: Colors.primaryLight }]}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: Colors.bgInput }]}
                onPress={() => navigation.navigate('AddSupplierPayment', { supplierId, supplierName: supplier.name })}
              >
                <Text style={styles.quickIcon}>💳</Text>
                <Text style={[styles.quickLabel, { color: Colors.primary }]}>Pay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: Colors.bgInput }]}
                onPress={() => navigation.navigate('SupplierLedger', { supplierId, supplierName: supplier.name })}
              >
                <Text style={styles.quickIcon}>📒</Text>
                <Text style={[styles.quickLabel, { color: Colors.warning }]}>Ledger</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Outstanding Balance */}
        {outstanding > 0 && (
          <View style={styles.outstandingCard}>
            <Text style={styles.outstandingLabel}>Outstanding Payable</Text>
            <Text style={styles.outstandingAmount}>{formatCurrency(outstanding)}</Text>
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={() => navigation.navigate('AddSupplierPayment', { supplierId, supplierName: supplier.name })}
            >
              <Text style={styles.payNowText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <InfoRow icon="📞" label="Phone" value={supplier.phone} />
          <InfoRow icon="✉️" label="Email" value={supplier.email} />
          <InfoRow icon="📍" label="Address" value={supplier.address} />
          <InfoRow icon="🏙️" label="City" value={supplier.city} />
        </View>

        {/* Notes */}
        {supplier.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{supplier.notes}</Text>
          </View>
        )}

        {/* Recent Payments */}
        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {payments.slice(0, 5).map(p => (
              <View key={p.id} style={styles.paymentRow}>
                <View>
                  <Text style={styles.paymentDate}>{p.payment_date}</Text>
                  <Text style={styles.paymentMethod}>{p.payment_method.replace('_', ' ')}</Text>
                  {p.reference && <Text style={styles.paymentRef}>Ref: {p.reference}</Text>}
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.navBtns}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.navigate('SupplierLedger', { supplierId, supplierName: supplier.name })}
          >
            <Text style={styles.navBtnIcon}>📒</Text>
            <Text style={styles.navBtnText}>View Ledger</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.navigate('CreatePurchaseInvoice', { supplierId, supplierName: supplier.name })}
          >
            <Text style={styles.navBtnIcon}>🧾</Text>
            <Text style={styles.navBtnText}>New Invoice</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑️ Delete Supplier</Text>
        </TouchableOpacity>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  editBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  editText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  identityCard: {
    backgroundColor: Colors.bgCard, margin: 16, borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  avatarLarge: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.bgInput,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: Colors.primaryLight },
  supplierName: { fontSize: 22, fontWeight: '800', color: Colors.textWhite, marginBottom: 4 },
  businessName: { fontSize: 14, color: Colors.textGray, marginBottom: 4 },
  cityText: { fontSize: 13, color: Colors.textMuted },
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  quickBtn: { alignItems: 'center', padding: 12, borderRadius: 14, minWidth: 64, borderWidth: 1, borderColor: Colors.border },
  quickIcon: { fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 11, fontWeight: '700' },
  outstandingCard: {
    backgroundColor: Colors.bgCard, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  outstandingLabel: { fontSize: 13, color: Colors.warning, fontWeight: '600' },
  outstandingAmount: { fontSize: 28, fontWeight: '800', color: Colors.warning, marginVertical: 6 },
  payNowBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  payNowText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: {
    backgroundColor: Colors.bgCard, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textWhite, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  infoIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginBottom: 1 },
  infoValue: { fontSize: 14, color: Colors.textWhite, fontWeight: '500' },
  notesText: { fontSize: 14, color: Colors.textGray, lineHeight: 20 },
  paymentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  paymentDate: { fontSize: 13, fontWeight: '600', color: Colors.textWhite },
  paymentMethod: { fontSize: 11, color: Colors.textGray, textTransform: 'capitalize', marginTop: 1 },
  paymentRef: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: Colors.success },
  navBtns: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 12 },
  navBtn: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  navBtnIcon: { fontSize: 24, marginBottom: 6 },
  navBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },
  deleteBtn: { marginHorizontal: 16, marginTop: 8, padding: 16, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, color: Colors.error, fontWeight: '600' },
});
