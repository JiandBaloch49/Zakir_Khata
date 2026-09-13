import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getFinancialMetrics, FinancialMetrics } from '../../services/database/reportDb';
import { formatCurrency } from '../../utils/calculations';
import { exportToCSV } from '../../utils/csvGenerator';

export const FinancialReportsScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id, period]);

  const loadData = async () => {
    setLoading(true);
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    }

    try {
      const data = await getFinancialMetrics(user!.id, startDate, endDate);
      setMetrics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!metrics) return;
    try {
      await exportToCSV(
        `Financial_Report_${period}`,
        ['Metric', 'Amount'],
        [
          ['Total Sales', metrics.totalSales],
          ['Total COGS', metrics.totalCOGS],
          ['Total Expenses', metrics.totalExpenses],
          ['Net Profit', metrics.netProfit]
        ]
      );
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const Bar = ({ label, value, max, color }: any) => {
    const percentage = max > 0 ? Math.max(5, Math.min(100, (value / max) * 100)) : 5;
    return (
      <View className="mb-4">
        <View className="flex-row justify-between mb-1">
          <Text className="text-gray-700 font-semibold">{label}</Text>
          <Text className="text-gray-900 font-bold">{formatCurrency(value)}</Text>
        </View>
        <View className="h-4 bg-gray-100 rounded-full w-full overflow-hidden">
          <View className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-green-600 px-5 pt-4 pb-4 flex-row items-center justify-between shadow-md z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-white text-2xl font-bold">{'<'}</Text>
          </TouchableOpacity>
          <Text className="text-white font-bold text-xl">Financial Reports</Text>
        </View>
        <TouchableOpacity onPress={handleExport}>
          <Text className="text-white font-bold">CSV</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${period === 'month' ? 'border-green-600' : 'border-transparent'}`}
          onPress={() => setPeriod('month')}
        >
          <Text className={`font-semibold ${period === 'month' ? 'text-green-600' : 'text-gray-500'}`}>This Month</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${period === 'year' ? 'border-green-600' : 'border-transparent'}`}
          onPress={() => setPeriod('year')}
        >
          <Text className={`font-semibold ${period === 'year' ? 'text-green-600' : 'text-gray-500'}`}>This Year</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {loading || !metrics ? (
          <ActivityIndicator size="large" color="#00A651" className="mt-10" />
        ) : (
          <View>
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
              <Text className="text-gray-500 text-sm mb-1">Net Profit</Text>
              <Text className={`text-4xl font-bold ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.netProfit)}
              </Text>
            </View>

            <View className="bg-white rounded-2xl p-5 mb-8 shadow-sm">
              <Text className="text-gray-800 font-bold text-lg mb-6">Profit & Loss Breakdown</Text>
              {(() => {
                const max = Math.max(metrics.totalSales, metrics.totalExpenses, metrics.totalCOGS, metrics.netProfit);
                return (
                  <>
                    <Bar label="Sales Revenue" value={metrics.totalSales} max={max} color="bg-blue-500" />
                    <Bar label="Cost of Goods (COGS)" value={metrics.totalCOGS} max={max} color="bg-orange-500" />
                    <Bar label="Overhead Expenses" value={metrics.totalExpenses} max={max} color="bg-red-500" />
                    <View className="border-t border-gray-200 pt-4 mt-2">
                      <Bar label="Net Profit" value={metrics.netProfit} max={max} color={metrics.netProfit >= 0 ? "bg-green-500" : "bg-red-500"} />
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
