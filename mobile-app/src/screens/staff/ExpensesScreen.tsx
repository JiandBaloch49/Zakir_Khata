import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useExpenseStore } from '../../store/useExpenseStore';
import { formatCurrency, formatDate, rupeesToPaisa } from '../../utils/calculations';

export const ExpensesScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { expenses, expenseTotal, loadExpenses, addExpense, removeExpense } = useExpenseStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) loadExpenses(user.id);
  }, [user?.id, loadExpenses]);

  const handleAddExpense = async () => {
    if (!amount.trim()) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }
    const paisa = rupeesToPaisa(amount);
    if (paisa === null) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      await addExpense(user.id, paisa, notes.trim() || undefined);
      setNotes('');
      setAmount('');
      setShowAddForm(false);
      Alert.alert('Success', 'Expense added');
    } catch {
      Alert.alert('Error', 'Failed to add expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, noteSummary: string) => {
    Alert.alert(
      'Delete Expense',
      `Delete expense: "${noteSummary || 'No notes'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              if (user?.id) await removeExpense(id, user.id);
            } catch {
              Alert.alert('Error', 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  const renderExpenseItem = ({ item }: { item: any }) => {
    // Detect if text is mostly Urdu/Arabic characters for RTL alignment
    const displayText = item.note || item.description || '';
    const isUrdu = /[\u0600-\u06FF]/.test(displayText);
    return (
      <TouchableOpacity
        onLongPress={() => handleDelete(item.id, displayText)}
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-1 pr-4">
            <Text
              className={`font-semibold text-gray-800 text-base ${isUrdu ? 'text-right' : 'text-left'}`}
              style={{ writingDirection: isUrdu ? 'rtl' : 'ltr' }}
            >
              {displayText || 'No description'}
            </Text>
            <Text className="text-gray-400 text-xs mt-1">{formatDate(item.created_at)}</Text>
          </View>
          <View className="items-end">
            <Text className="font-bold text-lg text-red-600">
              -{formatCurrency(Math.round((item.amount ?? 0) * 100))}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-primary px-4 pt-4 pb-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-white font-bold text-xl">Expenses Book (اخراجات)</Text>
          <TouchableOpacity onPress={() => user?.id && loadExpenses(user.id)}>
            <Text className="text-white font-semibold">Refresh</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="bg-white rounded-xl py-3 items-center shadow-sm"
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text className="text-primary font-bold text-base">
            {showAddForm ? '✕ Close Form' : '+ Add New Expense'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {showAddForm && (
          <View className="bg-white px-4 py-4 border-b border-gray-200 shadow-sm">
            <Text className="text-gray-700 font-semibold mb-2">New Expense Entry</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-gray-800 border border-gray-200"
              placeholder="Amount in Rs. (رقم)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-gray-800 border border-gray-200"
              placeholder="Short note / Details (تفصیل)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={{ textAlign: /[\u0600-\u06FF]/.test(notes) ? 'right' : 'left' }}
            />
            <TouchableOpacity
              className={`bg-primary py-3.5 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
              onPress={handleAddExpense}
              disabled={loading}
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Saving...' : 'Save Expense (محفوظ کریں)'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="bg-white px-5 py-4 border-b border-gray-200 shadow-sm flex-row justify-between items-center">
          <Text className="text-gray-500 font-medium text-base">Total Expenses</Text>
          <Text className="text-2xl font-black text-red-600">
            {formatCurrency(expenseTotal)}
          </Text>
        </View>

        {expenses.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            <Text className="text-gray-400 text-lg text-center">No expenses recorded yet</Text>
          </View>
        ) : (
          <FlatList
            data={expenses}
            renderItem={renderExpenseItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }}
            refreshing={false}
            onRefresh={() => user?.id && loadExpenses(user.id)}
          />
        )}
      </KeyboardAvoidingView>

      <TouchableOpacity
        onPress={() => setShowAddForm(true)}
        className="absolute bottom-6 right-6 bg-primary rounded-full w-14 h-14 items-center justify-center shadow-lg"
      >
        <Text className="text-white text-3xl font-bold">+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};
