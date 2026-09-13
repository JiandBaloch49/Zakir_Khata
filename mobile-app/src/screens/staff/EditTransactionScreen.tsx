import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform , StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getTransactionById, updateTransaction } from '../../services/database/transactionDb';
import { useTransactionStore } from '../../store/transactionStore';
import { rupeesToPaisa, paisaToRupeesString } from '../../utils/calculations';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { EntryHistoryMarker } from '../../components/ui/EntryHistory';
import { DateField } from '../../components/ui/DateField';

interface RouteParams { transactionId: string }

export const EditTransactionScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { loadTransactions } = useTransactionStore();
  const { transactionId } = route.params as RouteParams;

  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'lena' | 'dena'>('lena');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => { loadData(); }, [transactionId]);

  const loadData = async () => {
    try {
      const t = await getTransactionById(transactionId);
      if (t) {
        setPartyName(t.partyName);
        setAmount(paisaToRupeesString(t.amount_paisa));
        setType(t.type);
        setNotes(t.notes ?? '');
        setDate(t.date.split('T')[0]);
      }
    } catch {
      Alert.alert('Error', 'Failed to load transaction');
    } finally {
      setInitialLoading(false);
    }
  };

  const validate = (): number | null => {
    if (!partyName.trim()) { Alert.alert('Error', 'Please enter party name'); return null; }
    const paisa = rupeesToPaisa(amount);
    if (paisa === null) { Alert.alert('Error', 'Please enter a valid positive amount'); return null; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert('Error', 'Date must be YYYY-MM-DD'); return null; }
    return paisa;
  };

  const handleUpdate = async () => {
    const paisa = validate();
    if (paisa === null || !user) return;

    setLoading(true);
    try {
      // updateTransaction(id, userId, updates) — same shape as updateCashEntry.
      // amount_paisa is integer paisa (from rupeesToPaisa); date stays YYYY-MM-DD.
      await updateTransaction(transactionId, user.id, {
        partyName: partyName.trim(),
        amount_paisa: paisa,
        type,
        notes: notes.trim(),
        date,
      });
      await loadTransactions(user.id);
      Alert.alert('Success', 'Transaction updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      if (__DEV__) console.error('[EditTransaction] Failed to update:', err);
      Alert.alert('Error', err?.message || 'Failed to update transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <Text className="text-gray-600 text-lg">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenContainer scrollable={true} hasTabBar={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        <Text className="text-2xl font-bold text-gray-800 mb-6">Edit Transaction</Text>
        <EntryHistoryMarker entryId={transactionId} />

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Party Name *</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
              placeholder="Enter party name"
              value={partyName}
              onChangeText={setPartyName}
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Amount (Rs.) *</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
              placeholder="e.g. 1500.50"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Type *</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg border-2 ${type === 'lena' ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}
                onPress={() => setType('lena')}
              >
                <Text className={`text-center font-medium ${type === 'lena' ? 'text-white' : 'text-gray-800'}`}>Lena (Give)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg border-2 ${type === 'dena' ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'}`}
                onPress={() => setType('dena')}
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
              onChange={setDate}
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
            />
          </View>

          <TouchableOpacity
            className={`bg-green-600 py-4 rounded-lg ${loading ? 'opacity-70' : ''}`}
            onPress={handleUpdate}
            disabled={loading}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Updating...' : 'Update Transaction'}
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
