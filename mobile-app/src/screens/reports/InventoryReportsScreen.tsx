import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getFastMovingProducts, getDeadStock, ProductRank, DeadStock } from '../../services/database/reportDb';
import { formatCurrency } from '../../utils/calculations';
import { exportToCSV } from '../../utils/csvGenerator';

export const InventoryReportsScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [fastMoving, setFastMoving] = useState<ProductRank[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStock[]>([]);
  const [tab, setTab] = useState<'fast' | 'dead'>('fast');

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fast, dead] = await Promise.all([
        getFastMovingProducts(user!.id, 20),
        getDeadStock(user!.id, 30) // 30 days without sale
      ]);
      setFastMoving(fast);
      setDeadStock(dead);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      if (tab === 'fast') {
        await exportToCSV(
          'Fast_Moving_Products',
          ['Item Name', 'Quantity Sold', 'Revenue'],
          fastMoving.map(i => [i.itemName, i.quantitySold, i.revenue])
        );
      } else {
        await exportToCSV(
          'Dead_Stock_Report',
          ['Item Name', 'Current Quantity', 'Days Since Last Sale'],
          deadStock.map(i => [i.itemName, i.quantity, i.daysSinceLastSale])
        );
      }
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-orange-500 px-5 pt-4 pb-4 flex-row items-center justify-between shadow-md z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-white text-2xl font-bold">{'<'}</Text>
          </TouchableOpacity>
          <Text className="text-white font-bold text-xl">Inventory Reports</Text>
        </View>
        <TouchableOpacity onPress={handleExport}>
          <Text className="text-white font-bold">CSV</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${tab === 'fast' ? 'border-orange-500' : 'border-transparent'}`}
          onPress={() => setTab('fast')}
        >
          <Text className={`font-semibold ${tab === 'fast' ? 'text-orange-500' : 'text-gray-500'}`}>Fast Moving</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${tab === 'dead' ? 'border-orange-500' : 'border-transparent'}`}
          onPress={() => setTab('dead')}
        >
          <Text className={`font-semibold ${tab === 'dead' ? 'text-orange-500' : 'text-gray-500'}`}>Dead Stock</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {loading ? (
          <ActivityIndicator size="large" color="#f97316" className="mt-10" />
        ) : tab === 'fast' ? (
          <View className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <View className="flex-row bg-gray-100 p-3">
              <Text className="flex-1 font-bold text-gray-700 text-xs">PRODUCT</Text>
              <Text className="w-20 font-bold text-gray-700 text-xs text-right">QTY SOLD</Text>
              <Text className="w-24 font-bold text-gray-700 text-xs text-right">REVENUE</Text>
            </View>
            {fastMoving.length === 0 && <Text className="p-4 text-center text-gray-400">No sales data found.</Text>}
            {fastMoving.map((item, idx) => (
              <View key={idx} className="flex-row p-3 border-b border-gray-100 items-center">
                <Text className="flex-1 font-semibold text-gray-800">{item.itemName}</Text>
                <Text className="w-20 text-orange-600 font-bold text-right">{item.quantitySold}</Text>
                <Text className="w-24 text-gray-600 text-right">{formatCurrency(item.revenue)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <View className="flex-row bg-gray-100 p-3">
              <Text className="flex-1 font-bold text-gray-700 text-xs">PRODUCT</Text>
              <Text className="w-16 font-bold text-gray-700 text-xs text-right">STOCK</Text>
              <Text className="w-20 font-bold text-gray-700 text-xs text-right">DAYS IDLE</Text>
            </View>
            {deadStock.length === 0 && <Text className="p-4 text-center text-gray-400">No dead stock found. Great job!</Text>}
            {deadStock.map((item, idx) => (
              <View key={idx} className="flex-row p-3 border-b border-gray-100 items-center">
                <Text className="flex-1 font-semibold text-gray-800">{item.itemName}</Text>
                <Text className="w-16 text-gray-600 text-right">{item.quantity}</Text>
                <Text className="w-20 text-red-500 font-bold text-right">{item.daysSinceLastSale}d</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
