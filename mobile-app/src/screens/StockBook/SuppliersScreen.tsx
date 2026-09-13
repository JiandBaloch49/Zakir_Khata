import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { Supplier } from '../../types/supplier.types';
import { formatCurrency } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';

const SupplierCard = React.memo(({ item, onPress, onCall, onWhatsApp }: {
  item: Supplier;
  onPress: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
}) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.cardLeft}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.supplierName} numberOfLines={1}>{item.name}</Text>
        {item.business_name ? <Text style={styles.businessName} numberOfLines={1}>🏢 {item.business_name}</Text> : null}
        {item.phone ? <Text style={styles.phone}>📞 {item.phone}</Text> : null}
        {(item.outstanding_balance ?? 0) > 0 && (
          <View style={styles.outstandingBadge}>
            <Text style={styles.outstandingText}>
              Payable: {formatCurrency((item.outstanding_balance ?? 0))}
            </Text>
          </View>
        )}
      </View>
    </View>
    <View style={styles.cardActions}>
      {item.phone ? (
        <>
          <TouchableOpacity style={styles.actionBtn} onPress={onCall}>
            <Text style={styles.actionIcon}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]} onPress={onWhatsApp}>
            <Text style={styles.actionIcon}>💬</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  </TouchableOpacity>
));

export const SuppliersScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { suppliers, loading, loadSuppliers } = useSupplierStore();
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    if (user?.id) loadSuppliers(user.id);
  }, [user?.id]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const filtered = search.trim()
    ? suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.business_name?.toLowerCase().includes(search.toLowerCase()))
      )
    : suppliers;

  const handleCall = (phone: string) => Linking.openURL(`tel:${phone}`);
  const handleWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=92${clean.replace(/^0/, '')}`);
  };

  const totalOutstanding = suppliers.reduce((s, sup) => s + (sup.outstanding_balance ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Suppliers</Text>
          <Text style={styles.headerSub}>{suppliers.length} suppliers</Text>
        </View>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={() => navigation.navigate('AddSupplierModal')}>
          <Text style={styles.addHeaderText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScreenContainer scrollable={false} hasTabBar={true} style={styles.container}>
        {/* Outstanding Summary */}
        {totalOutstanding > 0 && (
          <TouchableOpacity style={styles.summaryBanner} onPress={() => navigation.navigate('OutstandingPayables')}>
            <Text style={styles.summaryLabel}>Total Outstanding Payables</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalOutstanding)}</Text>
            <Text style={styles.summaryArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or business..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textGray}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🏭</Text>
            <Text style={styles.emptyTitle}>{search ? 'No results found' : 'No Suppliers Yet'}</Text>
            <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Add your first supplier to get started'}</Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddSupplierModal')}>
                <Text style={styles.emptyBtnText}>+ Add Supplier</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <SupplierCard
                item={item}
                onPress={() => navigation.navigate('SupplierProfile', { supplierId: item.id })}
                onCall={() => item.phone && handleCall(item.phone)}
                onWhatsApp={() => item.phone && handleWhatsApp(item.phone)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  addHeaderBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addHeaderText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  summaryLabel: { flex: 1, fontSize: 13, color: Colors.warning, fontWeight: '600' },
  summaryAmount: { fontSize: 15, fontWeight: '800', color: Colors.warning, marginRight: 8 },
  summaryArrow: { fontSize: 16, color: Colors.warning },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput,
    margin: 16, borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8, color: Colors.textGray },
  searchInput: { flex: 1, height: 44, fontSize: 14, color: Colors.textWhite },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.primaryLight },
  cardInfo: { flex: 1 },
  supplierName: { fontSize: 15, fontWeight: '700', color: Colors.textWhite, marginBottom: 2 },
  businessName: { fontSize: 12, color: Colors.textGray, marginBottom: 2 },
  phone: { fontSize: 12, color: Colors.textGray },
  outstandingBadge: { marginTop: 4 },
  outstandingText: { fontSize: 12, fontWeight: '700', color: Colors.warning },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center' },
  actionIcon: { fontSize: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite, marginTop: 12 },
  emptySub: { fontSize: 13, color: Colors.textGray, marginTop: 4, textAlign: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
