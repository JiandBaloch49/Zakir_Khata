import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getPartyBalances } from '../../services/database/transactionDb';
import { autoSeedCustomersFromTransactions } from '../../services/database/customerDb';
import { formatCurrency, formatDate } from '../../utils/calculations';

interface PartyBalance {
  partyName: string;
  totalLena: number;
  totalDena: number;
  netBalance: number;
  phone?: string;
  notes?: string;
  lastTransactionDate?: string;
}

export const CustomerLedgerScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [parties, setParties] = useState<PartyBalance[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.id) loadParties();
    });
    if (user?.id) loadParties();
    return unsubscribe;
  }, [user?.id, navigation]);

  const loadParties = async () => {
    setLoading(true);
    try {
      await autoSeedCustomersFromTransactions(user!.id);
      const data = await getPartyBalances(user!.id);
      setParties(data);
    } finally {
      setLoading(false);
    }
  };

  const filtered = parties.filter(p => {
    const s = search.toLowerCase();
    const balancePaisa = p.netBalance;
    const balanceStr = (balancePaisa / 100).toString();
    return p.partyName.toLowerCase().includes(s) || 
           (p.phone && p.phone.includes(s)) ||
           balanceStr.includes(s);
  });

  const getStatusBadge = (item: PartyBalance) => {
    if (item.netBalance > 0) {
      if (item.totalDena > 0) return { label: '🟡 Partial', color: 'bg-yellow-100 text-yellow-800' };
      return { label: '🔴 Payment Due', color: 'bg-red-100 text-red-800' };
    }
    if (item.netBalance < 0) return { label: '🟢 Advance', color: 'bg-green-100 text-green-800' };
    if (item.totalLena > 0) return { label: '🟢 Paid', color: 'bg-green-100 text-green-800' };
    return { label: '⚪ No Balance', color: 'bg-gray-100 text-gray-800' };
  };

  const renderItem = ({ item }: { item: PartyBalance }) => {
    const status = getStatusBadge(item);
    return (
      <TouchableOpacity
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
        onPress={() => navigation.navigate('CustomerDetail', { partyName: item.partyName, userId: user?.id })}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="font-bold text-gray-900 text-lg">{item.partyName}</Text>
            {item.phone && <Text className="text-gray-500 text-sm mt-0.5">📞 {item.phone}</Text>}
          </View>
          <View className={`px-2.5 py-1 rounded-full ${status.color.split(' ')[0]}`}>
            <Text className={`text-xs font-semibold ${status.color.split(' ')[1]}`}>{status.label}</Text>
          </View>
        </View>
        
        <View className="flex-row justify-between items-end mt-2">
          <View>
            <Text className="text-gray-500 text-xs mb-1">Outstanding Balance</Text>
            <Text className={`font-bold text-xl ${item.netBalance > 0 ? 'text-red-600' : item.netBalance < 0 ? 'text-green-600' : 'text-gray-800'}`}>
              {formatCurrency(Math.abs(item.netBalance))}
              {item.netBalance > 0 ? ' (To Receive)' : item.netBalance < 0 ? ' (Advance)' : ''}
            </Text>
          </View>
        </View>

        {(item.lastTransactionDate) && (
          <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
            <Text className="text-gray-400 text-xs flex-1">Last Transaction: {formatDate(item.lastTransactionDate)}</Text>
            <Text className="text-blue-500 text-xs font-medium">View Ledger ➡️</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-green-600 px-5 pt-5 pb-6 rounded-b-[30px] shadow-sm">
        <Text className="text-white font-extrabold text-2xl mb-4">Customers</Text>
        <TextInput
          className="bg-white/90 rounded-xl px-4 py-3 text-gray-800 shadow-sm"
          placeholder="🔍 Search by Name, Phone, Amount..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#00A651" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-4xl mb-4">👥</Text>
          <Text className="text-gray-800 font-bold text-lg mb-2">No Customers Found</Text>
          <Text className="text-gray-500 text-center">Add a new customer to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.partyName}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 }}
          refreshing={loading}
          onRefresh={loadParties}
        />
      )}

      {/* Floating Action Button */}
      {!isKeyboardVisible && (
        <TouchableOpacity
          className="absolute bottom-24 right-6 bg-green-600 w-16 h-16 rounded-full items-center justify-center shadow-lg"
          onPress={() => navigation.navigate('AddCustomerModal', { onSave: loadParties })}
        >
          <Text className="text-white text-3xl mb-1">+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};
