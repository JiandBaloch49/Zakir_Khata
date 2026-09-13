import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, FlatList
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useBillStore } from '../../store/useBillStore';
import { getStockItemsByUserId, addStockMovement } from '../../services/database/stockDb';
import { getCustomers, addCustomer } from '../../services/database/customerDb';
import { StockItem } from '../../types/stock.types';
import { Customer } from '../../services/database/customerDb';
import { SelectItemsModal } from './SelectItemsModal';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { formatCurrency, rupeesToPaisa } from '../../utils/calculations';
import { DateField } from '../../components/ui/DateField';
import { todayDate, formatDisplayDate } from '../../utils/dates';

interface CartItem extends StockItem {
  cartQty: number;
}

export const CreateNewBillModal = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { addBill } = useBillStore();

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Form State
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(todayDate());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualAmount, setManualAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  
  // Modals & UI State
  const [loading, setLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);

  // Quick Party Creation State
  const [showAddPartyInput, setShowAddPartyInput] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);

  const handleCreateNewParty = async () => {
    if (!newPartyName.trim() || !user?.id) {
      Alert.alert('Required', 'Please enter a party name.');
      return;
    }
    setCreatingParty(true);
    try {
      // Mid-bill quick add stays lean (name + phone); the rest can be filled in later
      // from the Customer Book. customers has no current_balance column — passing it
      // made this INSERT fail, so the button never actually created anyone.
      const created = await addCustomer({
        user_id: user.id,
        name: newPartyName,
        phone: newPartyPhone,
      });
      setCustomers(prev => [created, ...prev]);
      setSelectedCustomer(created);
      setNewPartyName('');
      setNewPartyPhone('');
      setShowAddPartyInput(false);
      setShowCustomerModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add party.');
    } finally {
      setCreatingParty(false);
    }
  };
  
  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id]);

  const loadData = async (userId: string) => {
    try {
      const items = await getStockItemsByUserId(userId);
      setStockItems(items);
      const custs = await getCustomers(userId);
      setCustomers(custs);
    } catch (e) {
      console.error(e);
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, i) => sum + (i.sale_price * i.cartQty), 0);
  
  const calculatedTotal = subtotal > 0 
    ? subtotal
    : (rupeesToPaisa(manualAmount) ?? 0);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setAttachments(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const newBill = {
        user_id: user.id,
        bill_no: parseInt(billNumber) || undefined,
        customer_id: selectedCustomer?.id || 'walk_in',
        party_name: selectedCustomer?.name || 'Walk-in Customer',
        party_phone: selectedCustomer?.phone || undefined,
        bill_date: billDate,
        subtotal: subtotal > 0 ? subtotal : calculatedTotal,
        discount_pct: 0,
        discount_amount: 0,
        tax_amount: 0,
        total: calculatedTotal,
        paid: 0,
        due: calculatedTotal,
        status: 'unpaid' as any,
        payment_method: 'cash',
        is_draft: 0 as const,
        is_hold: 0 as const,
        notes: notes.trim() || undefined,
        attachment_urls: attachments.length > 0 ? attachments : undefined,
      };

      const billItems = cart.map(i => ({
        item_id: i.id,
        item_name: i.name_en,
        quantity: i.cartQty,
        unit_price: i.sale_price,
        line_total: i.cartQty * i.sale_price
      }));

      const { inActiveFilter } = await addBill(newBill as any, billItems as any);

      // Adjust Stock
      for (const i of cart) {
        await addStockMovement({
          item_id: i.id,
          change: -i.cartQty,
          reason: 'sale',
          date: todayDate(),
          cost_per_unit: i.purchase_price,
          sale_price_unit: i.sale_price,
          user_id: user.id,
          note: 'POS Sale'
        });
      }

      // The bill is saved either way. If it falls outside the range the Bill Book is
      // currently showing, say so rather than letting it look like it vanished.
      Alert.alert(
        'Success',
        inActiveFilter
          ? 'Bill created successfully.'
          : `Bill created successfully.\n\nIt is dated ${formatDisplayDate(billDate)}, which is outside the dates the Bill Book is currently showing. Change the date filter to see it.`
      );
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save bill.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Dark Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Bill</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Main Card Content */}
      <ScreenContainer scrollable={true} hasTabBar={true} style={styles.cardContainer} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Row 1: Bill Number & Date */}
        <View style={styles.row}>
          <View style={styles.inputWrap}>
            <View style={styles.floatingLabel}><Text style={styles.labelText}>Bill Number</Text></View>
            <TextInput 
              style={styles.input} 
              value={billNumber} 
              onChangeText={setBillNumber} 
              placeholder="Auto" 
              placeholderTextColor={Colors.textGray}
              keyboardType="numeric" 
            />
          </View>
          <View style={{ width: 16 }} />
          <View style={styles.inputWrap}>
            <View style={styles.floatingLabel}><Text style={styles.labelText}>Date</Text></View>
            <DateField style={styles.input} value={billDate} onChange={setBillDate} />
          </View>
        </View>

        {/* Add Customer */}
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowCustomerModal(true)}>
          <Text style={styles.actionText}>{selectedCustomer ? selectedCustomer.name : 'Add Customer'}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Add Items */}
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowItemsModal(true)}>
          <Text style={styles.actionText}>{cart.length > 0 ? `${cart.reduce((s,i)=>s+i.cartQty,0)} Items Added (${formatCurrency(subtotal)})` : 'Add Items'}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Invoice Amount */}
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Invoice Amount (Rs.)</Text>
          <TextInput
            style={[styles.input, styles.invoiceInput]}
            placeholder="0.00"
            placeholderTextColor={Colors.textGray}
            keyboardType="numeric"
            value={cart.length > 0 ? calculatedTotal.toString() : manualAmount}
            onChangeText={setManualAmount}
            editable={cart.length === 0}
          />
        </View>

        {/* Details / Notes */}
        <TextInput
          style={styles.textArea}
          placeholder="Enter details, notes..."
          placeholderTextColor={Colors.textGray}
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
        />

        {/* Attach Photos & PDF */}
        <TouchableOpacity style={styles.actionRow} onPress={pickImage}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, color: Colors.primaryLight, marginRight: 12 }}>📎</Text>
            <Text style={attachments.length > 0 ? styles.actionText : styles.actionTextGray}>
              {attachments.length > 0 ? `${attachments.length} Photos Attached` : 'Attach Photos'}
            </Text>
          </View>
        </TouchableOpacity>
        
        {attachments.length > 0 && (
          <TouchableOpacity onPress={() => setAttachments([])} style={{ alignSelf: 'flex-start', marginLeft: 4, marginBottom: 16 }}>
            <Text style={{ color: Colors.error, fontWeight: 'bold' }}>Clear Photos</Text>
          </TouchableOpacity>
        )}

        {/* SAVE BUTTON inside ScreenContainer */}
        <TouchableOpacity 
          style={[
            styles.saveBtn, 
            (!calculatedTotal || calculatedTotal <= 0 || loading) ? styles.saveBtnDisabled : null,
            { marginTop: 12 }
          ]} 
          onPress={handleSave}
          disabled={!calculatedTotal || calculatedTotal <= 0 || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>SAVE BILL</Text>}
        </TouchableOpacity>
      </ScreenContainer>

      {/* Select Items Modal */}
      <SelectItemsModal
        visible={showItemsModal}
        onClose={() => setShowItemsModal(false)}
        stockItems={stockItems}
        initialCart={cart}
        onSave={(newCart) => {
          setCart(newCart);
          setShowItemsModal(false);
        }}
      />

      {/* Customer Modal */}
      <Modal visible={showCustomerModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { height: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => { setShowCustomerModal(false); setShowAddPartyInput(false); }}>
                <Text style={{ fontSize: 24, color: Colors.textGray }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Add Customer Button / Form */}
            {!showAddPartyInput ? (
              <TouchableOpacity 
                style={{ backgroundColor: Colors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}
                onPress={() => setShowAddPartyInput(true)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ ADD CUSTOMER</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: Colors.bgInput, padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ color: Colors.textWhite, fontWeight: '700', marginBottom: 8, fontSize: 13 }}>New Customer Details</Text>
                <TextInput
                  style={{ backgroundColor: Colors.bgSecondary, color: Colors.textWhite, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border }}
                  placeholder="Customer Name *"
                  placeholderTextColor={Colors.textGray}
                  value={newPartyName}
                  onChangeText={setNewPartyName}
                />
                <TextInput
                  style={{ backgroundColor: Colors.bgSecondary, color: Colors.textWhite, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border }}
                  placeholder="Phone Number (Optional)"
                  placeholderTextColor={Colors.textGray}
                  keyboardType="phone-pad"
                  value={newPartyPhone}
                  onChangeText={setNewPartyPhone}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: Colors.textGray, padding: 10, borderRadius: 8, alignItems: 'center' }}
                    onPress={() => setShowAddPartyInput(false)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: Colors.success, padding: 10, borderRadius: 8, alignItems: 'center' }}
                    onPress={handleCreateNewParty}
                    disabled={creatingParty}
                  >
                    {creatingParty ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>SAVE CUSTOMER</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.customerItem, !selectedCustomer && { backgroundColor: Colors.bgInput }]}
              onPress={() => { setSelectedCustomer(null); setShowCustomerModal(false); }}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: Colors.textWhite }}>Walk-in Customer</Text>
            </TouchableOpacity>
            <FlatList
              data={customers}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.customerItem, selectedCustomer?.id === item.id && { backgroundColor: Colors.bgInput }]}
                  onPress={() => { setSelectedCustomer(item); setShowCustomerModal(false); }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: Colors.textWhite }}>{item.name}</Text>
                  {!!item.phone && <Text style={{ color: Colors.textGray, marginTop: 2 }}>{item.phone}</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, justifyContent: 'center' },
  backIcon: { fontSize: 24, fontWeight: 'bold', color: Colors.textWhite },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  
  cardContainer: {
    flex: 1, backgroundColor: Colors.bgPrimary,
  },
  
  row: { flexDirection: 'row', marginBottom: 16 },
  inputWrap: { flex: 1, position: 'relative', marginTop: 8 },
  floatingLabel: {
    position: 'absolute', top: -10, left: 16, zIndex: 1,
    backgroundColor: Colors.bgCard, paddingHorizontal: 6, borderRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  labelText: { color: Colors.textGray, fontSize: 12 },
  input: {
    height: 50, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, color: Colors.textWhite, fontSize: 16,
    backgroundColor: Colors.bgInput,
  },
  
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 54, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, marginBottom: 16, backgroundColor: Colors.bgCard,
  },
  actionText: { fontSize: 16, color: Colors.primaryLight, fontWeight: '600' },
  actionTextGray: { fontSize: 16, color: Colors.textGray },
  chevron: { fontSize: 20, color: Colors.primaryLight, fontWeight: 'bold' },

  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, marginTop: 4, gap: 12,
  },
  invoiceLabel: { fontSize: 15, color: Colors.textWhite, flex: 1, fontWeight: '600' },
  invoiceInput: { flex: 1, textAlign: 'right', fontWeight: 'bold' },
  
  textArea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    padding: 16, color: Colors.textWhite, fontSize: 16, minHeight: 90,
    textAlignVertical: 'top', marginBottom: 16, backgroundColor: Colors.bgInput,
  },

  saveBtn: {
    backgroundColor: Colors.primary, height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textWhite, marginBottom: 16 },
  customerItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 10, marginBottom: 4 },
  
  datePickerCard: {
    backgroundColor: Colors.bgCard, margin: 24, padding: 24, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateDisplay: { fontSize: 18, fontWeight: '600', color: Colors.textWhite, textAlign: 'center', marginBottom: 20 },
  dateBtn: {
    backgroundColor: Colors.bgInput, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  dateBtnText: { fontWeight: '600', color: Colors.textWhite },
});
