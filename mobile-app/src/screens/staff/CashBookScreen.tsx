import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTransactionStore } from '../../store/transactionStore';
import { CashEntry } from '../../types';
import { formatCurrency, formatDate, rupeesToPaisa } from '../../utils/calculations';
import { createCashEntry } from '../../services/database/cashbookDb';
import { generateCashbookPDF } from '../../utils/pdfGenerator';

export const CashBookScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { cashBook, cashSummary, loadCashBook } = useTransactionStore();
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (user?.id) loadCashBook(user.id);
  }, [user?.id]);

  const filteredCashBook = cashBook.filter(e => filterType === 'all' || e.direction === filterType);

  const handleAddEntry = async () => {
    if (!description.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const paisa = rupeesToPaisa(amount);
    if (paisa === null) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }
    if (!user) return;

    try {
      await createCashEntry(user.id, description.trim(), paisa, direction);
      await loadCashBook(user.id);
      setDescription('');
      setAmount('');
      setShowAddForm(false);
      Alert.alert('Success', 'Cash entry added');
    } catch {
      Alert.alert('Error', 'Failed to add cash entry. Please try again.');
    }
  };

  const handleGeneratePDF = async () => {
    if (filteredCashBook.length === 0) {
      Alert.alert('No Data', 'There are no cash entries to export');
      return;
    }
    try {
      await generateCashbookPDF(filteredCashBook, user?.businessName || 'My Business', user?.name || 'Staff');
    } catch {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  const renderCashEntry = ({ item }: { item: CashEntry }) => {
    const isIn = item.direction === 'in';
    return (
      <View className="bg-white rounded-lg p-4 mb-2 shadow-sm">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="font-semibold text-gray-800 text-base">{item.description}</Text>
            <Text className="text-gray-500 text-sm">{formatDate(item.date)}</Text>
          </View>
          <View className="items-end">
            <Text className={`font-bold text-lg ${isIn ? 'text-green-600' : 'text-red-600'}`}>
              {isIn ? '+' : '-'}{formatCurrency(item.amount_paisa)}
            </Text>
            <Text className={`text-xs font-medium ${isIn ? 'text-green-500' : 'text-red-500'}`}>
              {isIn ? 'Cash In' : 'Cash Out'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-green-600 px-4 pt-4 pb-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-white font-bold text-xl">Cash Book</Text>
          <TouchableOpacity onPress={handleGeneratePDF}>
            <Text className="text-white font-semibold">Export PDF</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 mb-3">
          {(['all', 'in', 'out'] as const).map(f => (
            <TouchableOpacity
              key={f}
              className={`flex-1 py-2 rounded-lg ${filterType === f ? 'bg-white' : 'bg-green-700'}`}
              onPress={() => setFilterType(f)}
            >
              <Text className={`text-center font-medium capitalize ${filterType === f ? 'text-green-600' : 'text-white'}`}>
                {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className="bg-white rounded-lg py-2 items-center"
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text className="text-green-600 font-semibold">+ Add Cash Entry</Text>
        </TouchableOpacity>
      </View>

      {showAddForm && (
        <View className="bg-white px-4 py-4 border-b border-gray-200">
          <TextInput
            className="bg-gray-100 rounded-lg px-4 py-2 mb-2 text-gray-800"
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            className="bg-gray-100 rounded-lg px-4 py-2 mb-2 text-gray-800"
            placeholder="Amount (Rs.)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <View className="flex-row gap-2 mb-2">
            {(['in', 'out'] as const).map(d => (
              <TouchableOpacity
                key={d}
                className={`flex-1 py-2 rounded-lg ${direction === d ? (d === 'in' ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-200'}`}
                onPress={() => setDirection(d)}
              >
                <Text className={`text-center font-medium ${direction === d ? 'text-white' : 'text-gray-800'}`}>
                  {d === 'in' ? 'Cash In' : 'Cash Out'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity className="bg-green-600 py-2 rounded-lg items-center" onPress={handleAddEntry}>
            <Text className="text-white font-semibold">Save Entry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-gray-600 text-sm">Total In</Text>
            <Text className="text-green-600 font-bold">{formatCurrency(cashSummary.cashIn)}</Text>
          </View>
          <View>
            <Text className="text-gray-600 text-sm">Total Out</Text>
            <Text className="text-red-600 font-bold">{formatCurrency(cashSummary.cashOut)}</Text>
          </View>
          <View>
            <Text className="text-gray-600 text-sm">Balance</Text>
            <Text className={`font-bold ${cashSummary.cashBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(cashSummary.cashBalance)}
            </Text>
          </View>
        </View>
      </View>

      {filteredCashBook.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-gray-400 text-lg">No cash entries found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCashBook}
          renderItem={renderCashEntry}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          refreshing={false}
          onRefresh={() => user?.id && loadCashBook(user.id)}
        />
      )}
    </SafeAreaView>
  );
};
