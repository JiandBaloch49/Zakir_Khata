import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/authStore';
import { addStockMovement } from '../../services/database/stockDb';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { todayDate } from '../../utils/dates';

const BLUE = '#3B82F6';
const RED = '#EF4444';
const GRAY_BG = '#F3F4F6';

export const ReturnItemsModal = ({ route, navigation }: any) => {
  const { billId } = route.params;
  const { bills, updateBillItemRecord } = useBillStore();
  const { user } = useAuthStore();
  
  const bill = bills.find(b => b.id === billId);
  const [loading, setLoading] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});

  if (!bill) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ textAlign: 'center', marginTop: 20 }}>Bill not found.</Text>
        <TouchableOpacity style={styles.btnGray} onPress={() => navigation.goBack()}>
          <Text>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleReturn = async () => {
    if (!user) return;
    
    const itemsToReturn = Object.entries(returnQty)
      .map(([id, qty]) => ({ id, qty: parseInt(qty, 10) }))
      .filter(i => !isNaN(i.qty) && i.qty > 0);

    if (itemsToReturn.length === 0) {
      return Alert.alert('Error', 'Please enter a valid quantity to return.');
    }

    setLoading(true);
    try {
      for (const { id, qty } of itemsToReturn) {
        const item = bill.items.find(i => i.id === id);
        if (!item) continue;
        
        const maxReturn = item.quantity - (item.returned_quantity || 0);
        if (qty > maxReturn) {
          throw new Error(`Cannot return more than ${maxReturn} for ${item.item_name}`);
        }

        // 1. Update bill item record
        const newReturnedQty = (item.returned_quantity || 0) + qty;
        await updateBillItemRecord(id, billId, user.id, { returned_quantity: newReturnedQty });

        // 2. Adjust Stock
        if (item.item_id) {
          await addStockMovement({
            item_id: item.item_id,
            change: qty, // Positive change to replenish stock
            reason: 'adjustment',
            date: todayDate(),
            user_id: user.id,
            note: `Returned from Bill #${bill.bill_no}`
          });
        }
      }

      Alert.alert('Success', 'Items returned and stock replenished.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to return items.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenContainer scrollable={false} hasTabBar={true}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Return Items (Bill #{bill.bill_no})</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={bill.items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const alreadyReturned = item.returned_quantity || 0;
            const maxReturn = item.quantity - alreadyReturned;

            return (
              <View style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemDetail}>Purchased: {item.quantity}</Text>
                  {alreadyReturned > 0 && <Text style={styles.itemDetailRed}>Already Returned: {alreadyReturned}</Text>}
                </View>
                {maxReturn > 0 ? (
                  <View style={styles.qtyInputWrap}>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Return Qty</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="0"
                      value={returnQty[item.id] || ''}
                      onChangeText={txt => setReturnQty(prev => ({ ...prev, [item.id]: txt }))}
                    />
                  </View>
                ) : (
                  <View style={styles.qtyInputWrap}>
                    <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Fully Returned</Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btnBlue} onPress={handleReturn} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Process Return</Text>}
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  itemCard: {
    flexDirection: 'row', padding: 16, borderRadius: 12, backgroundColor: GRAY_BG,
    marginBottom: 12, alignItems: 'center', justifyContent: 'space-between'
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  itemDetail: { fontSize: 14, color: '#4B5563' },
  itemDetailRed: { fontSize: 14, color: RED, marginTop: 2 },
  qtyInputWrap: { alignItems: 'center' },
  input: {
    width: 60, height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, textAlign: 'center', fontWeight: 'bold'
  },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  btnBlue: { backgroundColor: BLUE, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnGray: { backgroundColor: GRAY_BG, padding: 12, borderRadius: 8, alignItems: 'center', alignSelf: 'center', marginTop: 20 }
});
