import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import { getCustomerPerformance, getKhataSummary, CustomerPerformance, KhataSummary } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { formatCurrency } from '../../utils/calculations';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

export const PartyReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerPerformance[]>([]);
  const [khata, setKhata] = useState<KhataSummary[]>([]);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');
  const [activeTab, setActiveTab] = useState<'customers' | 'khata'>('customers');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const cust = await getCustomerPerformance(user.id, newFilter, 'totalPurchases', 10);
      const khat = await getKhataSummary(user.id, newFilter, 'all', 10);
      setCustomers(cust);
      setKhata(khat);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filter);
  }, [filter, user]);

  const handleExport = async () => {
    if (activeTab === 'customers' && customers.length > 0) {
      const data = customers.map(c => ({
        'Customer Name': c.customerName,
        'Total Purchases': c.totalPurchases,
        'Total Paid': c.totalPaid,
        'Total Due': c.totalDue,
        'Last Active': c.lastActive
      }));
      handleReportExport(`Customer_Performance_${filterLabel}`, data, 'Customers');
    } else if (activeTab === 'khata' && khata.length > 0) {
      const data = khata.map(k => ({
        'Party Name': k.partyName,
        'Total Lena (Receivable)': k.totalLena,
        'Total Dena (Payable)': k.totalDena,
        'Net Balance': k.netBalance
      }));
      handleReportExport(`Khata_Balances_${filterLabel}`, data, 'Khata');
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Party Reports</Text>
          <TouchableOpacity onPress={handleExport}>
            <Text className="text-white text-base">Export</Text>
          </TouchableOpacity>
        </View>
        <DateFilterPicker onFilterChange={(f, l) => { setFilter(f); setFilterLabel(l); }} />
      </View>

      <View className="flex-row mx-4 -mt-6 bg-white rounded-xl shadow-sm p-1 border border-gray-100">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'customers' ? 'bg-blue-50' : ''}`}
          onPress={() => setActiveTab('customers')}
        >
          <Text className={`font-semibold ${activeTab === 'customers' ? 'text-blue-600' : 'text-gray-500'}`}>Customers (Sales)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'khata' ? 'bg-blue-50' : ''}`}
          onPress={() => setActiveTab('khata')}
        >
          <Text className={`font-semibold ${activeTab === 'khata' ? 'text-blue-600' : 'text-gray-500'}`}>Khata (Ledger)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
        ) : activeTab === 'customers' ? (
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <Text className="text-gray-800 font-bold text-lg mb-4">Top 10 Customers by Purchases</Text>

            {customers.length === 0 ? (
              <Text className="text-gray-400 py-4 text-center">No customer data for this period</Text>
            ) : (
              customers.map((c, idx) => (
                <View key={c.customerId} className={`py-3 ${idx < customers.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="font-semibold text-gray-900 flex-1">{idx + 1}. {c.customerName}</Text>
                    <Text className="font-bold text-blue-600">{formatCurrency(c.totalPurchases)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-xs">Due: {formatCurrency(c.totalDue)}</Text>
                    <Text className="text-gray-400 text-xs">Last: {c.lastActive}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <Text className="text-gray-800 font-bold text-lg mb-4">Top 10 Khata Balances</Text>

            {khata.length === 0 ? (
              <Text className="text-gray-400 py-4 text-center">No khata data for this period</Text>
            ) : (
              khata.map((k, idx) => (
                <View key={k.partyName + idx} className={`py-3 ${idx < khata.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="font-semibold text-gray-900 flex-1">{idx + 1}. {k.partyName}</Text>
                    <Text className={`font-bold ${k.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(k.netBalance))} {k.netBalance >= 0 ? '(Get)' : '(Give)'}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-xs">Lena: {formatCurrency(k.totalLena)}</Text>
                    <Text className="text-gray-500 text-xs">Dena: {formatCurrency(k.totalDena)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};
