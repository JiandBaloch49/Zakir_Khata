import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Alert, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { searchCustomers, addCustomer, updateCustomer, customerPhotoUri, canViewCnic, Customer, CustomerCursor } from '../../services/database/customerDb';
import { PAGE_SIZE } from '../../services/database/pagination';
import { Colors } from '../../theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';
import { CustomerAvatar } from '../../components/ui/CustomerAvatar';
import { pickCustomerPhoto, persistCustomerPhoto } from '../../utils/customerPhoto';

export const CustomerBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<CustomerCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Customer Modal (same sheet; editingId decides which)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCnic, setShowCnic] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setName(''); setPhone(''); setNotes(''); setEmail(''); setCnic(''); setAddress(''); setCity('');
    setPhotoUri(null);
    setModalVisible(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setName(c.name); setPhone(c.phone || ''); setNotes(c.notes || '');
    setEmail(c.email || ''); setCnic(c.cnic || ''); setAddress(c.address || ''); setCity(c.city || '');
    setPhotoUri(customerPhotoUri(c));
    setModalVisible(true);
  };

  // Search runs in SQL and the list is paged, so a shop with thousands of customers
  // never loads them all; the count is the SQL count of the whole match.
  const fetchCustomers = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const page = await searchCustomers(user.id, searchQuery, PAGE_SIZE);
      setCustomers(page.rows);
      setTotal(page.total);
      setCursor(page.nextCursor);
    } catch (err) {
      if (__DEV__) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!user?.id || !cursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await searchCustomers(user.id, searchQuery, PAGE_SIZE, cursor);
      setCustomers(prev => [...prev, ...page.rows]);
      setCursor(page.nextCursor);
    } catch (err) {
      if (__DEV__) console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [user?.id, searchQuery]);

  useEffect(() => {
    if (user?.id) canViewCnic(user.id).then(setShowCnic).catch(() => setShowCnic(false));
  }, [user?.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCustomers();
    });
    return unsubscribe;
  }, [navigation, user?.id]);

  const handleAddCustomer = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter customer name.');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      // Format rules (phone/email/CNIC) are enforced inside customerDb so this
      // sheet, AddCustomerModal and the bill quick-add all behave the same.
      // A sub-staff never sees the CNIC, so their save never carries the key — the
      // data layer would refuse a value and must not be handed a blank to wipe with.
      const fields = { name, phone, notes, email, address, city, ...(showCnic ? { cnic } : {}) };
      if (editingId) {
        const durable = photoUri ? await persistCustomerPhoto(photoUri, editingId) : null;
        await updateCustomer(editingId, user.id, { ...fields, photo_local_path: durable });
        await fetchCustomers();
        Alert.alert('Saved', 'Customer details updated.');
      } else {
        const newCust = await addCustomer({ user_id: user.id, ...fields });
        if (photoUri) {
          // Copy out of the picker cache into app storage, then point the row at the copy.
          const durable = await persistCustomerPhoto(photoUri, newCust.id);
          await updateCustomer(newCust.id, user.id, { photo_local_path: durable });
          newCust.photo_local_path = durable;
        }
        await fetchCustomers();
        Alert.alert('Success', 'Customer added successfully!');
      }
      setModalVisible(false);
    } catch (err: any) {
      // err.message is a validation message (never field contents) or a generic failure.
      Alert.alert('Error', err?.message || 'Failed to save customer.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers;

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const place = [item.address, item.city].filter(Boolean).join(', ');
    return (
      <TouchableOpacity style={styles.customerCard} onPress={() => openEdit(item)} activeOpacity={0.7}>
        <CustomerAvatar name={item.name} uri={customerPhotoUri(item)} style={styles.avatar} textStyle={styles.avatarText} />
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          {item.phone ? (
            <Text style={styles.customerSub}>📞 {item.phone}</Text>
          ) : null}
          {place ? (
            <Text style={styles.customerSub}>📍 {place}</Text>
          ) : null}
          {item.notes ? (
            <Text style={styles.customerNotes}>📝 {item.notes}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Top Header with Books Navigation Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="CustomerBook" />

      {/* Sub Header */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderTitle}>Customer Book ({total})</Text>
        <TouchableOpacity
          style={styles.addBtnHeader}
          onPress={openAdd}
        >
          <Text style={styles.addBtnHeaderText}>+ Add Customer</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer by name or phone..."
          placeholderTextColor={Colors.textGray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Customers List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredCustomers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyTitle}>No Customers Found</Text>
          <Text style={styles.emptyText}>Tap "+ Add Customer" to add your first customer.</Text>
          <TouchableOpacity
            style={styles.addBtnEmpty}
            onPress={openAdd}
          >
            <Text style={styles.addBtnEmptyText}>+ ADD CUSTOMER</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={Colors.primary} /> : null}
        />
      )}

      {/* Add Customer Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Customer' : 'Add New Customer'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Photo (Optional)</Text>
              <TouchableOpacity style={styles.photoRow} onPress={async () => { const uri = await pickCustomerPhoto(); if (uri) setPhotoUri(uri); }}>
                <CustomerAvatar name={name || '?'} uri={photoUri} style={styles.avatar} textStyle={styles.avatarText} />
                <Text style={styles.photoHint}>{photoUri ? 'Change Photo' : 'Add Photo'}</Text>
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Customer Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter customer name"
                placeholderTextColor={Colors.textGray}
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <Text style={styles.modalLabel}>Phone Number (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter phone number"
                placeholderTextColor={Colors.textGray}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.modalLabel}>Email (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter email address"
                placeholderTextColor={Colors.textGray}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              {showCnic && <><Text style={styles.modalLabel}>CNIC (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="12345-1234567-1"
                placeholderTextColor={Colors.textGray}
                keyboardType="numbers-and-punctuation"
                maxLength={15}
                value={cnic}
                onChangeText={setCnic}
              /></>}

              <Text style={styles.modalLabel}>Address (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter address"
                placeholderTextColor={Colors.textGray}
                value={address}
                onChangeText={setAddress}
              />

              <Text style={styles.modalLabel}>City (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter city"
                placeholderTextColor={Colors.textGray}
                value={city}
                onChangeText={setCity}
              />

              <Text style={styles.modalLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="Enter notes..."
                placeholderTextColor={Colors.textGray}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddCustomer}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? 'SAVE CHANGES' : 'SAVE CUSTOMER'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  addBtnHeader: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textWhite,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  customerCard: {
    backgroundColor: Colors.bgCard,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  customerSub: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  customerNotes: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 20,
  },
  addBtnEmpty: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addBtnEmptyText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  closeBtn: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textGray,
    padding: 4,
  },
  modalBody: {},
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  photoHint: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textWhite,
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
