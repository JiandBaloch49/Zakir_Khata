import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getTopCustomers, getStaffPerformance, CustomerRank, StaffPerformance } from '../../services/database/reportDb';
import { formatCurrency } from '../../utils/calculations';
import { exportToCSV } from '../../utils/csvGenerator';

export const PeopleReportsScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRank[]>([]);
  const [staff, setStaff] = useState<StaffPerformance[]>([]);
  const [tab, setTab] = useState<'customers' | 'staff'>('customers');

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topCustomers, staffPerf] = await Promise.all([
        getTopCustomers(user!.id, 20),
        getStaffPerformance(user!.id)
      ]);
      setCustomers(topCustomers);
      setStaff(staffPerf);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      if (tab === 'customers') {
        await exportToCSV(
          'Best_Customers',
          ['Customer Name', 'Total Spend'],
          customers.map(c => [c.partyName, c.totalSpend])
        );
      } else {
        await exportToCSV(
          'Staff_Performance',
          ['Staff Name', 'Bills Generated', 'Total Sales Volume'],
          staff.map(s => [s.staffName, s.billsGenerated, s.totalSales])
        );
      }
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-purple-600 px-5 pt-4 pb-4 flex-row items-center justify-between shadow-md z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-white text-2xl font-bold">{'<'}</Text>
          </TouchableOpacity>
          <Text className="text-white font-bold text-xl">People Insights</Text>
        </View>
        <TouchableOpacity onPress={handleExport}>
          <Text className="text-white font-bold">CSV</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${tab === 'customers' ? 'border-purple-600' : 'border-transparent'}`}
          onPress={() => setTab('customers')}
        >
          <Text className={`font-semibold ${tab === 'customers' ? 'text-purple-600' : 'text-gray-500'}`}>Top Customers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${tab === 'staff' ? 'border-purple-600' : 'border-transparent'}`}
          onPress={() => setTab('staff')}
        >
          <Text className={`font-semibold ${tab === 'staff' ? 'text-purple-600' : 'text-gray-500'}`}>Staff Performance</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {loading ? (
          <ActivityIndicator size="large" color="#9333ea" className="mt-10" />
        ) : tab === 'customers' ? (
          <View className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <View className="flex-row bg-gray-100 p-3">
              <Text className="flex-1 font-bold text-gray-700 text-xs">CUSTOMER</Text>
              <Text className="w-24 font-bold text-gray-700 text-xs text-right">TOTAL SPEND</Text>
            </View>
            {customers.length === 0 && <Text className="p-4 text-center text-gray-400">No customers found.</Text>}
            {customers.map((c, idx) => (
              <View key={idx} className="flex-row p-3 border-b border-gray-100 items-center">
                <Text className="flex-1 font-semibold text-gray-800">{c.partyName}</Text>
                <Text className="w-24 text-green-600 font-bold text-right">{formatCurrency(c.totalSpend)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <View className="flex-row bg-gray-100 p-3">
              <Text className="flex-1 font-bold text-gray-700 text-xs">STAFF NAME</Text>
              <Text className="w-16 font-bold text-gray-700 text-xs text-center">BILLS</Text>
              <Text className="w-24 font-bold text-gray-700 text-xs text-right">SALES</Text>
            </View>
            {staff.length === 0 && <Text className="p-4 text-center text-gray-400">No staff activity found.</Text>}
            {staff.map((s, idx) => (
              <View key={idx} className="flex-row p-3 border-b border-gray-100 items-center">
                <Text className="flex-1 font-semibold text-gray-800">{s.staffName}</Text>
                <Text className="w-16 text-gray-600 text-center font-bold">{s.billsGenerated}</Text>
                <Text className="w-24 text-blue-600 font-bold text-right">{formatCurrency(s.totalSales)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
