import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform , StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { createTransaction } from '../../services/database/transactionDb';
import { searchCustomers, Customer } from '../../services/database/customerDb';
import { useTransactionStore } from '../../store/transactionStore';
import { rupeesToPaisa } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

interface Props {
  navigation: any;
}

export const AddTransactionScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { loadTransactions } = useTransactionStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partyName, setPartyName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'lena' | 'dena'>('lena');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayDate());
  const [loading, setLoading] = useState(false);

  // The picker narrows via SQL as you type — at most 20 matches, never the whole
  // customer list — so starting an entry costs the same at 40 customers or 4,000.
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    searchCustomers(user.id, partyName, 20)
      .then(page => { if (active) setCustomers(page.rows); })
      .catch(e => { if (__DEV__) console.error('[AddTransaction] customer search failed:', e); });
    return () => { active = false; };
  }, [user?.id, partyName]);

  const filteredCustomers = customers;

  const validate = (): number | null => {
    if (!partyName.trim()) {
      Alert.alert('Error', 'Please select or enter a party name');
      return null;
    }
    const paisa = rupeesToPaisa(amount);
    if (paisa === null) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Error', 'Date must be YYYY-MM-DD');
      return null;
    }
    return paisa;
  };

  const handleSave = async () => {
    const paisa = validate();
    if (paisa === null || !user) return;

    setLoading(true);
    try {
      await createTransaction(user.id, partyName.trim(), paisa, type, notes.trim() || undefined, date, undefined);
      await loadTransactions(user.id);
      Alert.alert('Success', 'Transaction added', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenContainer scrollable={true} hasTabBar={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        <Text className="text-2xl font-bold text-gray-800 mb-6">Add Transaction</Text>

          <View className="mb-4 z-50">
            <Text className="text-gray-700 font-medium mb-2">Customer Name *</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
              placeholder="Select or enter customer"
              value={partyName}
              onChangeText={(txt) => { setPartyName(txt); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && (
              <View className="bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-hidden absolute w-full top-[75px] z-50 shadow-md">
                <ScrollView keyboardShouldPersistTaps="handled">
                  {filteredCustomers.map(c => (
                    <TouchableOpacity 
                      key={c.id} 
                      className="p-3 border-b border-gray-100"
                      onPress={() => { setPartyName(c.name); setShowDropdown(false); }}
                    >
                      <Text className="text-gray-800 font-medium">{c.name}</Text>
                      {c.phone && <Text className="text-gray-500 text-xs">{c.phone}</Text>}
                    </TouchableOpacity>
                  ))}
                  {partyName.trim() !== '' && !filteredCustomers.find(c => c.name.toLowerCase() === partyName.trim().toLowerCase()) && (
                    <TouchableOpacity 
                      className="p-3 bg-green-50"
                      onPress={() => { setShowDropdown(false); navigation.navigate('AddCustomerModal', { onSave: (nc: Customer) => { setPartyName(nc.name); setCustomers([nc, ...customers]); } }); }}
                    >
                      <Text className="text-green-700 font-medium">+ Create new customer: "{partyName}"</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          <View className="mb-4 mt-2">
            <Text className="text-gray-700 font-medium mb-2">Amount (Rs.) *</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
              placeholder="e.g. 1500.50"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              onFocus={() => setShowDropdown(false)}
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Type *</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg border-2 ${type === 'lena' ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}
                onPress={() => { setType('lena'); setShowDropdown(false); }}
              >
                <Text className={`text-center font-medium ${type === 'lena' ? 'text-white' : 'text-gray-800'}`}>Lena (Give)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg border-2 ${type === 'dena' ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'}`}
                onPress={() => { setType('dena'); setShowDropdown(false); }}
              >
                <Text className={`text-center font-medium ${type === 'dena' ? 'text-white' : 'text-gray-800'}`}>Dena (Take)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Date *</Text>
            <DateField
              style={styles.dateField}
              textStyle={styles.dateFieldText}
              value={date}
              onChange={d => { setShowDropdown(false); setDate(d); }}
            />
          </View>

          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Notes (Optional)</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
              placeholder="Enter notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              onFocus={() => setShowDropdown(false)}
            />
          </View>

          <TouchableOpacity
            className={`bg-green-600 py-4 rounded-lg ${loading ? 'opacity-70' : ''}`}
            onPress={handleSave}
            disabled={loading}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Saving...' : 'Save Transaction'}
            </Text>
          </TouchableOpacity>
      </ScreenContainer>
    </SafeAreaView>
  );
};

// Matches the sibling className fields exactly: bg-white / border-gray-300 /
// rounded-lg / px-4 py-3 / text-gray-800, so the date field looks unchanged in place.
const styles = StyleSheet.create({
  dateField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateFieldText: { color: '#1F2937', fontSize: 15 },
});
