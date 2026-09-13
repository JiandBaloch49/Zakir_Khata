import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { PieChart } from 'react-native-gifted-charts';
import { useAuthStore } from '../../store/authStore';
import { getInventorySummary, getProductPerformance, InventorySummary, ProductPerformance } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { formatCurrency } from '../../utils/calculations';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

export const InventoryReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [performance, setPerformance] = useState<ProductPerformance[]>([]);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const sum = await getInventorySummary(user.id);
      const perf = await getProductPerformance(user.id, newFilter.startDate, newFilter.endDate, 'revenue', 'DESC', 10);
      setSummary(sum);
      setPerformance(perf);
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
    if (!summary || performance.length === 0) return;
    try {
      const data = performance.map(p => ({
        'Item Name': p.itemName,
        'Qty Sold': p.quantitySold,
        'Revenue': p.revenue,
        'Profit': p.profit
      }));
      handleReportExport(`Inventory_Performance_${filterLabel}`, data, 'Performance');
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const pieData = summary ? [
    { value: summary.totalValue, color: '#f59e0b', text: 'Cost' },
    { value: summary.expectedProfit, color: '#10b981', text: 'Profit' },
  ] : [];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Inventory</Text>
          <TouchableOpacity onPress={handleExport}>
            <Text className="text-white text-base">Export</Text>
          </TouchableOpacity>
        </View>
        <DateFilterPicker onFilterChange={(f, l) => { setFilter(f); setFilterLabel(l); }} />
      </View>

      <ScrollView className="flex-1 px-4 -mt-8" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
        ) : summary ? (
          <>
            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 flex-row flex-wrap justify-between">
              <View className="w-[48%] mb-4">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Valuation</Text>
                <Text className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalSellingValue)}</Text>
              </View>
              <View className="w-[48%] mb-4">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Items</Text>
                <Text className="text-xl font-bold text-gray-900">{summary.totalItems}</Text>
              </View>
              <View className="w-[48%]">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Low Stock</Text>
                <Text className="text-lg font-bold text-orange-500">{summary.lowStockCount}</Text>
              </View>
              <View className="w-[48%]">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Out of Stock</Text>
                <Text className="text-lg font-bold text-red-500">{summary.outOfStockCount}</Text>
              </View>
            </View>

            {summary.totalValue > 0 && (
              <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
                <Text className="text-gray-800 font-bold text-lg mb-4">Value vs Expected Profit</Text>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center">
                    <PieChart
                      data={pieData}
                      donut
                      radius={60}
                      innerRadius={35}
                    />
                  </View>
                  <View className="flex-1 pl-4">
                    <View className="mb-3">
                      <View className="flex-row items-center mb-1">
                        <View className="w-3 h-3 rounded-full bg-amber-500 mr-2" />
                        <Text className="text-gray-600 text-xs">Cost Value</Text>
                      </View>
                      <Text className="font-bold">{formatCurrency(summary.totalValue)}</Text>
                    </View>
                    <View>
                      <View className="flex-row items-center mb-1">
                        <View className="w-3 h-3 rounded-full bg-emerald-500 mr-2" />
                        <Text className="text-gray-600 text-xs">Expected Profit</Text>
                      </View>
                      <Text className="font-bold">{formatCurrency(summary.expectedProfit)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <Text className="text-gray-800 font-bold text-lg mb-4">Top Performing Products</Text>

              {performance.length === 0 ? (
                <Text className="text-gray-400 py-4 text-center">No sales data for this period</Text>
              ) : (
                performance.map((p, idx) => (
                  <View key={p.itemId} className={`py-3 ${idx < performance.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <View className="flex-row justify-between mb-1">
                      <Text className="font-semibold text-gray-900 flex-1">{idx + 1}. {p.itemName}</Text>
                      <Text className="font-bold text-blue-600">{formatCurrency(p.revenue)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-500 text-xs">{p.quantitySold} units sold</Text>
                      <Text className="text-green-600 text-xs">Profit: {formatCurrency(p.profit)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
