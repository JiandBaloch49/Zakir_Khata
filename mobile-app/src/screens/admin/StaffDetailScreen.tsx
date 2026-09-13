import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { User, Transaction, CashEntry } from '../../types';
import { Expense } from '../../types/expense.types';
import { getTransactionsByUserId, getBalanceSummary } from '../../services/database/transactionDb';
import { getCashEntriesByUserId, getCashBalanceSummary } from '../../services/database/cashbookDb';
import { getExpensesByUserId, getExpenseBalanceSummary } from '../../services/database/expenseDb';
import { getSubStaffByParentId } from '../../services/database/userDb';
import { formatCurrency, formatDate } from '../../utils/calculations';
import { TransactionItem } from '../../components/TransactionItem';

interface RouteParams { staff: User }

type TabType = 'khata' | 'cash' | 'expenses' | 'substaff';

export const StaffDetailScreen = ({ navigation }: any) => {
  const route = useRoute();
  const { staff } = route.params as RouteParams;

  const [activeTab, setActiveTab] = useState<TabType>('khata');
  const [loading, setLoading] = useState(true);

  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState({ totalLena: 0, totalDena: 0, netBalance: 0 });
  const [cashbook, setCashbook] = useState<CashEntry[]>([]);
  const [cashSummary, setCashSummary] = useState({ cashIn: 0, cashOut: 0, cashBalance: 0 });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [subStaff, setSubStaff] = useState<User[]>([]);

  useEffect(() => {
    loadAllData();
  }, [staff.id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        txList, txBalances,
        cbList, cbBalances,
        expList, expBalances,
        subs
      ] = await Promise.all([
        getTransactionsByUserId(staff.id, 50, 0),
        getBalanceSummary(staff.id),
        getCashEntriesByUserId(staff.id, 50, 0),
        getCashBalanceSummary(staff.id),
        getExpensesByUserId(staff.id, 50, 0),
        getExpenseBalanceSummary(staff.id),
        getSubStaffByParentId(staff.id)
      ]);

      setTransactions(txList);
      setBalances({
        totalLena: txBalances.totalLena,
        totalDena: txBalances.totalDena,
        netBalance: txBalances.totalLena - txBalances.totalDena
      });
      setCashbook(cbList);
      setCashSummary({
        cashIn: cbBalances.cashIn,
        cashOut: cbBalances.cashOut,
        cashBalance: cbBalances.cashIn - cbBalances.cashOut
      });
      setExpenses(expList);
      setExpenseTotal(expBalances.totalExpense);
      setSubStaff(subs);
    } catch (error) {
      console.error('Failed to load portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <TransactionItem transaction={item} onPress={() => {}} />
  );

  const renderCashItem = ({ item }: { item: CashEntry }) => {
    const isIn = item.direction === 'in';
    return (
      <View className="bg-white rounded-lg p-4 mb-2 shadow-sm border border-gray-100">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="font-semibold text-gray-800 text-sm">{item.description}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{formatDate(item.date)}</Text>
          </View>
          <Text className={`font-bold ${isIn ? 'text-green-600' : 'text-red-600'}`}>
            {isIn ? '+' : '-'}{formatCurrency(item.amount_paisa)}
          </Text>
        </View>
      </View>
    );
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <View className="bg-white rounded-lg p-4 mb-2 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-center">
        <View className="flex-1 pr-4">
          <Text className="font-semibold text-gray-800 text-sm">{item.description || item.note || 'No description'}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{formatDate(item.created_at)}</Text>
        </View>
        <Text className="font-bold text-red-600">
          -{formatCurrency(item.amount)}
        </Text>
      </View>
    </View>
  );

  const renderSubStaffItem = ({ item }: { item: User }) => (
    <View className="bg-white rounded-lg p-4 mb-2 shadow-sm border border-gray-100">
      <Text className="font-semibold text-gray-800 text-base">{item.name}</Text>
      <Text className="text-gray-500 text-sm">{item.phone}</Text>
      <Text className="text-gray-400 text-xs mt-1">Registered: {new Date(item.createdAt).toLocaleDateString()}</Text>
    </View>
  );

  const renderContent = () => {
    if (activeTab === 'khata') {
      return (
        <View className="flex-1">
          <View className="bg-white p-4 rounded-xl mb-4 border border-gray-100 shadow-sm flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-gray-400 text-xs font-semibold">Lena</Text>
              <Text className="text-green-600 font-bold text-base mt-0.5">{formatCurrency(balances.totalLena)}</Text>
            </View>
            <View className="items-center flex-1 border-x border-gray-100">
              <Text className="text-gray-400 text-xs font-semibold">Dena</Text>
              <Text className="text-red-600 font-bold text-base mt-0.5">{formatCurrency(balances.totalDena)}</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-gray-400 text-xs font-semibold">Net</Text>
              <Text className={`font-bold text-base mt-0.5 ${balances.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(balances.netBalance)}
              </Text>
            </View>
          </View>
          {transactions.length === 0 ? (
            <Text className="text-center text-gray-400 my-8">No transaction data</Text>
          ) : (
            <FlatList
              data={transactions}
              renderItem={renderTransactionItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      );
    }

    if (activeTab === 'cash') {
      return (
        <View className="flex-1">
          <View className="bg-white p-4 rounded-xl mb-4 border border-gray-100 shadow-sm flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-gray-400 text-xs font-semibold">Total In</Text>
              <Text className="text-green-600 font-bold text-base mt-0.5">{formatCurrency(cashSummary.cashIn)}</Text>
            </View>
            <View className="items-center flex-1 border-x border-gray-100">
              <Text className="text-gray-400 text-xs font-semibold">Total Out</Text>
              <Text className="text-red-600 font-bold text-base mt-0.5">{formatCurrency(cashSummary.cashOut)}</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-gray-400 text-xs font-semibold">Cash Balance</Text>
              <Text className={`font-bold text-base mt-0.5 ${cashSummary.cashBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(cashSummary.cashBalance)}
              </Text>
            </View>
          </View>
          {cashbook.length === 0 ? (
            <Text className="text-center text-gray-400 my-8">No cash book data</Text>
          ) : (
            <FlatList
              data={cashbook}
              renderItem={renderCashItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      );
    }

    if (activeTab === 'expenses') {
      return (
        <View className="flex-1">
          <View className="bg-white p-4 rounded-xl mb-4 border border-gray-100 shadow-sm flex-row justify-between items-center">
            <Text className="text-gray-500 font-medium">Total Expenses</Text>
            <Text className="text-xl font-bold text-red-600">{formatCurrency(expenseTotal)}</Text>
          </View>
          {expenses.length === 0 ? (
            <Text className="text-center text-gray-400 my-8">No expense data</Text>
          ) : (
            <FlatList
              data={expenses}
              renderItem={renderExpenseItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      );
    }

    if (activeTab === 'substaff') {
      return (
        <View className="flex-1">
          <Text className="text-gray-500 font-medium mb-3">Sub-Staff Registered by {staff.name}</Text>
          {subStaff.length === 0 ? (
            <Text className="text-center text-gray-400 my-8">No registered sub-staff</Text>
          ) : (
            <FlatList
              data={subStaff}
              renderItem={renderSubStaffItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-primary px-4 pt-4 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Text className="text-white text-2xl font-bold">←</Text>
          </TouchableOpacity>
          <View>
            <Text className="text-white font-bold text-lg">{staff.name}</Text>
            <Text className="text-white text-xs opacity-90">{staff.businessName || 'Business'}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#00A651" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4">
          {/* Tabs */}
          <View className="flex-row bg-gray-200 p-1 rounded-xl mb-4">
            {(['khata', 'cash', 'expenses', 'substaff'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 py-2.5 rounded-lg ${activeTab === tab ? 'bg-white shadow-sm' : ''}`}
                onPress={() => setActiveTab(tab)}
              >
                <Text className={`text-center font-bold text-xs capitalize ${activeTab === tab ? 'text-primary' : 'text-gray-500'}`}>
                  {tab === 'substaff' ? 'Sub Staff' : tab === 'khata' ? 'Khata' : tab === 'cash' ? 'Cash' : 'Expenses'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderContent()}
          <View className="h-10" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
